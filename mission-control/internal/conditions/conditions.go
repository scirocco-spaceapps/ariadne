// Package conditions builds GET /conditions: live space weather from NASA DONKI, the modeled
// radiation dose rate from model/params.json and archive MEDA weather from content/conditions.
// A part that cannot be filled is null with a reason; no value is ever made up.
package conditions

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io/fs"
	"log/slog"
	"os"
	"sync"
	"time"

	"github.com/ozyusuf/ariadne/mission-control/internal/contract"
)

const (
	// CacheTTL is how long a DONKI answer is reused.
	CacheTTL = 15 * time.Minute
	// Window is how far back DONKI is searched.
	Window = 30 * 24 * time.Hour

	donkiSource    = "NASA DONKI WSA-ENLIL simulations (CCMC), CME arrivals forecast for Mars"
	donkiSourceURL = "https://kauai.ccmc.gsfc.nasa.gov/DONKI/"
	partnerMissing = "no partner-agency value yet (task M6)"
)

// Config locates the inputs.
type Config struct {
	ParamsPath string // model/params.json (MODEL_PARAMS_PATH)
	MEDAPath   string // content/conditions/meda.json (MEDA_PATH)
	DONKI      *DONKI
	Now        func() time.Time
}

// Service answers GET /conditions.
type Service struct {
	cfg Config

	mu        sync.Mutex
	last      *contract.SpaceWeather // last good DONKI answer
	lastFetch time.Time              // when last was fetched
	lastTry   time.Time              // when DONKI was last asked, good or not
	lastErr   error
}

// New returns a service. cfg.Now defaults to time.Now.
func New(cfg Config) *Service {
	if cfg.Now == nil {
		cfg.Now = time.Now
	}
	return &Service{cfg: cfg}
}

// Get builds the conditions. Only the DONKI part does network I/O, and only once per CacheTTL.
func (s *Service) Get(ctx context.Context) contract.Conditions {
	var c contract.Conditions
	var err error
	if c.SpaceWeather, err = s.spaceWeather(ctx); err != nil {
		c.Missing.SpaceWeather = err.Error()
	}
	if c.Radiation, err = readRadiation(s.cfg.ParamsPath); err != nil {
		c.Missing.Radiation = err.Error()
	}
	if c.Weather, err = readWeather(s.cfg.MEDAPath); err != nil {
		c.Missing.Weather = err.Error()
	}
	c.Missing.Partner = partnerMissing
	return c
}

func (s *Service) spaceWeather(ctx context.Context) (*contract.SpaceWeather, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	now := s.cfg.Now()
	// Within the TTL of the last attempt, answer from memory; this also rate-limits a failing feed.
	if !s.lastTry.IsZero() && now.Sub(s.lastTry) < CacheTTL {
		return s.cachedLocked()
	}
	s.lastTry = now
	if s.cfg.DONKI == nil {
		s.lastErr = errors.New("DONKI client not configured")
		return s.cachedLocked()
	}
	events, err := s.cfg.DONKI.MarsArrivals(ctx, now.Add(-Window), now)
	if err != nil {
		slog.Warn("DONKI fetch failed", "err", err)
		s.lastErr = err
		return s.cachedLocked()
	}
	s.lastErr = nil
	s.lastFetch = now
	s.last = &contract.SpaceWeather{
		Source: contract.Source{
			Provenance: "Modeled",
			Source:     donkiSource,
			SourceURL:  donkiSourceURL,
			Mode:       contract.ModeLive,
			FetchedAt:  now.UTC().Format(time.RFC3339),
		},
		Events: events,
	}
	return s.cachedLocked()
}

// cachedLocked returns a copy of the last good answer, marked stale when the latest attempt failed.
func (s *Service) cachedLocked() (*contract.SpaceWeather, error) {
	if s.last == nil {
		if s.lastErr == nil {
			return nil, errors.New("space weather not fetched yet")
		}
		return nil, fmt.Errorf("DONKI unavailable: %v", s.lastErr)
	}
	sw := *s.last
	sw.Stale = s.lastErr != nil
	return &sw, nil
}

// param is one entry of model/params.json.
type param struct {
	Value      *float64 `json:"value"`
	Unit       string   `json:"unit"`
	Provenance string   `json:"provenance"`
	Source     string   `json:"source"`
	MeasuredAt string   `json:"measured_at"`
}

func readRadiation(path string) (*contract.Radiation, error) {
	b, err := os.ReadFile(path)
	if err != nil {
		return nil, fileErr("model/params.json", err)
	}
	var params map[string]json.RawMessage
	if err := json.Unmarshal(b, &params); err != nil {
		return nil, fmt.Errorf("model/params.json is not valid JSON: %v", err)
	}
	var p *param
	if raw, ok := params["radiation_dose_rate"]; ok {
		_ = json.Unmarshal(raw, &p) // null or a malformed entry both leave p empty
	}
	if p == nil || p.Value == nil || p.Unit == "" || p.Source == "" {
		return nil, errors.New("radiation_dose_rate in model/params.json has no value, unit and source yet (task B1)")
	}
	return &contract.Radiation{
		// The dose rate was measured elsewhere (Gale, MSL RAD); for Jezero it is a model.
		Source:     contract.Source{Provenance: "Modeled", Source: p.Source, Mode: contract.ModeArchive},
		Value:      *p.Value,
		Unit:       p.Unit,
		MeasuredAt: p.MeasuredAt,
	}, nil
}

// medaFile is content/conditions/meda.json (docs/PLAN_CHANGES.md, task B4).
type medaFile struct {
	Sol        *int                `json:"sol"`
	Values     map[string]*float64 `json:"values"`
	Units      map[string]string   `json:"units"`
	Source     string              `json:"source"`
	SourceURL  string              `json:"source_url"`
	Provenance string              `json:"provenance"`
}

func readWeather(path string) (*contract.Weather, error) {
	b, err := os.ReadFile(path)
	if err != nil {
		return nil, fileErr("content/conditions/meda.json", err)
	}
	var m medaFile
	if err := json.Unmarshal(b, &m); err != nil {
		return nil, fmt.Errorf("content/conditions/meda.json is not valid: %v", err)
	}
	if len(m.Values) == 0 || m.Units == nil || m.Source == "" {
		return nil, errors.New("content/conditions/meda.json needs values, units and source")
	}
	prov := m.Provenance
	if prov == "" {
		prov = "Observed"
	}
	return &contract.Weather{
		Source: contract.Source{Provenance: prov, Source: m.Source, SourceURL: m.SourceURL, Mode: contract.ModeArchive},
		Sol:    m.Sol,
		Values: m.Values,
		Units:  m.Units,
	}, nil
}

func fileErr(name string, err error) error {
	if errors.Is(err, fs.ErrNotExist) {
		return fmt.Errorf("%s not found", name)
	}
	return fmt.Errorf("%s unreadable: %v", name, err)
}
