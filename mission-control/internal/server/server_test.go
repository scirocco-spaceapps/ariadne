package server

import (
	"encoding/json"
	"net/http/httptest"
	"testing"
)

func TestHealth(t *testing.T) {
	resp, err := New().Test(httptest.NewRequest("GET", "/health", nil))
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		t.Fatalf("status = %d, want 200", resp.StatusCode)
	}
	var got Health
	if err := json.NewDecoder(resp.Body).Decode(&got); err != nil {
		t.Fatal(err)
	}
	if got != (Health{Status: "ok", Service: "mission-control"}) {
		t.Fatalf("body = %+v", got)
	}
}
