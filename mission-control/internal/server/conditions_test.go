package server

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"github.com/ozyusuf/ariadne/mission-control/internal/contract"
)

func TestConditionsEndpoint(t *testing.T) {
	body, err := os.ReadFile("../conditions/testdata/donki_enlil_2026-11-14.json")
	if err != nil {
		t.Fatal(err)
	}
	donki := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) { _, _ = w.Write(body) }))
	defer donki.Close()

	cfg := DefaultConfig()
	cfg.DONKIBaseURL = donki.URL
	cfg.NASAAPIKey = "test"
	cfg.ParamsPath = "../../../model/params.json"
	cfg.MEDAPath = "../../../content/conditions/meda.json"
	s := New(cfg)
	t.Cleanup(s.Sessions.Close)

	resp, err := s.App.Test(httptest.NewRequest("GET", "/conditions", nil))
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	var raw map[string]json.RawMessage
	if err := json.NewDecoder(resp.Body).Decode(&raw); err != nil || resp.StatusCode != 200 {
		t.Fatalf("status %d err %v", resp.StatusCode, err)
	}
	for _, k := range []string{"weather", "radiation", "space_weather", "partner", "missing"} {
		if _, ok := raw[k]; !ok {
			t.Fatalf("key %q missing: every part is present, null or not", k)
		}
	}
	var sw contract.SpaceWeather
	if err := json.Unmarshal(raw["space_weather"], &sw); err != nil || len(sw.Events) != 3 || sw.Mode != "live" {
		t.Fatalf("space_weather = %s", raw["space_weather"])
	}
}
