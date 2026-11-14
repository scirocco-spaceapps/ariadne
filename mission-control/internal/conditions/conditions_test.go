package conditions

import (
	"context"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/ozyusuf/ariadne/mission-control/internal/contract"
)

// Recorded on 2026-11-14 from api.nasa.gov/DONKI/WSAEnlilSimulations (real data, trimmed to five
// simulations: three with a Mars impact, one without, one with no impact list).
const recorded = "testdata/donki_enlil_2026-11-14.json"

// fakeDONKI serves the recorded response, or fails while failing is set.
func fakeDONKI(t *testing.T) (*DONKI, *atomic.Int32, *atomic.Bool) {
	t.Helper()
	body, err := os.ReadFile(recorded)
	if err != nil {
		t.Fatal(err)
	}
	var calls atomic.Int32
	var failing atomic.Bool
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls.Add(1)
		if failing.Load() || r.URL.Path != "/WSAEnlilSimulations" || r.URL.Query().Get("api_key") != "k" {
			w.WriteHeader(http.StatusServiceUnavailable)
			return
		}
		_, _ = w.Write(body)
	}))
	t.Cleanup(srv.Close)
	return &DONKI{BaseURL: srv.URL, APIKey: "k", HTTP: srv.Client()}, &calls, &failing
}

func TestMarsArrivalsFromRecordedResponse(t *testing.T) {
	d, _, _ := fakeDONKI(t)
	events, err := d.MarsArrivals(context.Background(), time.Now().Add(-Window), time.Now())
	if err != nil {
		t.Fatal(err)
	}
	want := []contract.SpaceWeatherEvent{
		{ID: "WSA-ENLIL/49216/1", MarsArrivalUTC: "2026-10-27T12:00:00Z"},
		{ID: "WSA-ENLIL/49251/1", MarsArrivalUTC: "2026-10-30T18:00:00Z"},
		{ID: "WSA-ENLIL/49248/1", MarsArrivalUTC: "2026-11-01T01:00:00Z"},
	}
	if len(events) != len(want) {
		t.Fatalf("events = %+v", events)
	}
	for i, e := range events {
		if e.ID != want[i].ID || e.MarsArrivalUTC != want[i].MarsArrivalUTC || !strings.HasPrefix(e.Source, "https://") {
			t.Fatalf("event %d = %+v, want %+v with a link source", i, e, want[i])
		}
	}
}

func TestSpaceWeatherCacheAndStale(t *testing.T) {
	d, calls, failing := fakeDONKI(t)
	now := time.Date(2026, 11, 14, 12, 0, 0, 0, time.UTC)
	s := New(Config{DONKI: d, Now: func() time.Time { return now }})

	sw, err := s.spaceWeather(context.Background())
	if err != nil || sw.Stale || len(sw.Events) != 3 || sw.FetchedAt != "2026-11-14T12:00:00Z" || sw.Mode != "live" {
		t.Fatalf("first fetch = %+v, %v", sw, err)
	}
	now = now.Add(10 * time.Minute)
	if _, _ = s.spaceWeather(context.Background()); calls.Load() != 1 {
		t.Fatalf("within 15 min DONKI was called %d times, want 1", calls.Load())
	}

	failing.Store(true)
	now = now.Add(10 * time.Minute)
	sw, err = s.spaceWeather(context.Background())
	if err != nil || !sw.Stale || sw.FetchedAt != "2026-11-14T12:00:00Z" || len(sw.Events) != 3 {
		t.Fatalf("after a failed refresh = %+v, %v; want the last good copy, stale", sw, err)
	}

	failing.Store(false)
	now = now.Add(16 * time.Minute)
	if sw, _ = s.spaceWeather(context.Background()); sw.Stale {
		t.Fatal("a good refresh clears stale")
	}
}

func TestSpaceWeatherNeverFetched(t *testing.T) {
	d, _, failing := fakeDONKI(t)
	failing.Store(true)
	c := New(Config{DONKI: d}).Get(context.Background())
	if c.SpaceWeather != nil || !strings.Contains(c.Missing.SpaceWeather, "DONKI unavailable") {
		t.Fatalf("space weather = %+v, missing %q", c.SpaceWeather, c.Missing.SpaceWeather)
	}
}

func write(t *testing.T, name, body string) string {
	t.Helper()
	p := filepath.Join(t.TempDir(), name)
	if err := os.WriteFile(p, []byte(body), 0o644); err != nil {
		t.Fatal(err)
	}
	return p
}

func TestRadiation(t *testing.T) {
	tests := []struct {
		name, body string
		ok         bool
	}{
		{"empty template", `{"radiation_dose_rate": null}`, false},
		{"value without source", `{"radiation_dose_rate": {"value": 1, "unit": "x"}}`, false},
		{"filled", `{"radiation_dose_rate": {"value": 233, "unit": "uGy/day", "provenance": "Observed",
			"source": "Paper X", "measured_at": "Gale crater (MSL RAD); Modeled for Jezero"}}`, true},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			r, err := readRadiation(write(t, "params.json", tc.body))
			if (err == nil) != tc.ok {
				t.Fatalf("err = %v, want ok %v", err, tc.ok)
			}
			if tc.ok && (r.Value != 233 || r.Provenance != "Modeled" || r.Mode != "archive" || r.MeasuredAt == "") {
				t.Fatalf("radiation = %+v", r)
			}
		})
	}
	if _, err := readRadiation(filepath.Join(t.TempDir(), "nope.json")); err == nil || !strings.Contains(err.Error(), "not found") {
		t.Fatalf("missing file err = %v", err)
	}
}

func TestWeather(t *testing.T) {
	w, err := readWeather(write(t, "meda.json", `{"sol": 1250,
		"values": {"air_temp_min": -80.5, "air_temp_max": -12, "pressure": 735, "dust_opacity": null},
		"units": {"air_temp_min": "degC", "air_temp_max": "degC", "pressure": "Pa", "dust_opacity": "tau"},
		"source": "MEDA paper", "source_url": "https://example.org/meda", "provenance": "Observed"}`))
	if err != nil {
		t.Fatal(err)
	}
	if *w.Sol != 1250 || *w.Values["pressure"] != 735 || w.Values["dust_opacity"] != nil || w.Mode != "archive" {
		t.Fatalf("weather = %+v", w)
	}
	if _, err := readWeather(write(t, "meda.json", `{"values": {}}`)); err == nil {
		t.Fatal("empty meda.json must be missing, not a made-up value")
	}
}

func TestGetWithRepoFiles(t *testing.T) {
	// The repo as it is today: params.json is an empty template and meda.json does not exist.
	d, _, _ := fakeDONKI(t)
	c := New(Config{ParamsPath: "../../../model/params.json", MEDAPath: "../../../content/conditions/meda.json", DONKI: d}).
		Get(context.Background())
	if c.SpaceWeather == nil || c.Missing.Partner == "" {
		t.Fatalf("conditions = %+v", c)
	}
	if (c.Radiation == nil) == (c.Missing.Radiation == "") || (c.Weather == nil) == (c.Missing.Weather == "") {
		t.Fatalf("every null part needs a reason and only those: %+v", c)
	}
}
