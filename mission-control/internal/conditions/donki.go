package conditions

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"sort"
	"strings"
	"time"

	"github.com/ozyusuf/ariadne/mission-control/internal/contract"
)

// DONKIBaseURL is NASA's public API gateway for DONKI.
const DONKIBaseURL = "https://api.nasa.gov/DONKI"

// enlilSim is the part of one WSAEnlilSimulations record we read.
type enlilSim struct {
	SimulationID string `json:"simulationID"`
	Link         string `json:"link"`
	ImpactList   []struct {
		Location    string `json:"location"`
		ArrivalTime string `json:"arrivalTime"`
	} `json:"impactList"`
}

// DONKI fetches WSA-ENLIL simulations from NASA DONKI.
type DONKI struct {
	BaseURL string
	APIKey  string
	HTTP    *http.Client
}

// MarsArrivals returns every simulated CME arrival at Mars between from and to, by arrival time.
func (d *DONKI) MarsArrivals(ctx context.Context, from, to time.Time) ([]contract.SpaceWeatherEvent, error) {
	q := url.Values{}
	q.Set("startDate", from.UTC().Format("2006-01-02"))
	q.Set("endDate", to.UTC().Format("2006-01-02"))
	q.Set("api_key", d.APIKey)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, strings.TrimRight(d.BaseURL, "/")+"/WSAEnlilSimulations?"+q.Encode(), nil)
	if err != nil {
		return nil, err
	}
	resp, err := d.HTTP.Do(req)
	if err != nil {
		return nil, fmt.Errorf("DONKI: %w", err) // never echo the URL: it holds the key
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("DONKI: status %d", resp.StatusCode)
	}
	var sims []enlilSim
	if err := json.NewDecoder(resp.Body).Decode(&sims); err != nil {
		return nil, fmt.Errorf("DONKI: %w", err)
	}
	return marsEvents(sims), nil
}

func marsEvents(sims []enlilSim) []contract.SpaceWeatherEvent {
	events := []contract.SpaceWeatherEvent{}
	for _, s := range sims {
		for _, imp := range s.ImpactList {
			if imp.Location != "Mars" {
				continue
			}
			at, err := parseDONKITime(imp.ArrivalTime)
			if err != nil {
				continue
			}
			src := s.Link
			if src == "" {
				src = "NASA DONKI WSA-ENLIL " + s.SimulationID
			}
			events = append(events, contract.SpaceWeatherEvent{
				ID:             s.SimulationID,
				MarsArrivalUTC: at.UTC().Format(time.RFC3339),
				Source:         src,
			})
		}
	}
	sort.SliceStable(events, func(i, j int) bool { return events[i].MarsArrivalUTC < events[j].MarsArrivalUTC })
	return events
}

// parseDONKITime reads DONKI's "2026-10-27T12:00Z" (no seconds) and full RFC 3339.
func parseDONKITime(s string) (time.Time, error) {
	for _, layout := range []string{"2006-01-02T15:04Z07:00", time.RFC3339} {
		if t, err := time.Parse(layout, s); err == nil {
			return t, nil
		}
	}
	return time.Time{}, fmt.Errorf("bad DONKI time %q", s)
}
