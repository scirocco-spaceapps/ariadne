package sim

import (
	"encoding/json"
	"math"
	"os"
	"reflect"
	"testing"

	"github.com/ozyusuf/ariadne/mission-control/internal/contract"
)

func ip(i int) *int       { return &i }
func sp(s string) *string { return &s }

// toyRoute: haven (0,0) -> s1 (100,0) in 10 min, dwell 5, s1 -> s2 (100,50) via an L in 10 min.
func toyRoute() contract.RouteResponse {
	return contract.RouteResponse{
		Legs: []contract.Leg{
			{From: "haven", To: "s1", Path: []contract.XY{{0, 0}, {100, 0}}},
			{From: "s1", To: "s2", Path: []contract.XY{{100, 0}, {100, 25}, {100, 50}}},
		},
		Timeline: []contract.TimelineItem{
			{Kind: "walk", Leg: ip(0), T0Min: 0, T1Min: 10},
			{Kind: "dwell", Stop: sp("s1"), T0Min: 10, T1Min: 15},
			{Kind: "walk", Leg: ip(1), T0Min: 15, T1Min: 25},
			{Kind: "dwell", Stop: sp("s2"), T0Min: 25, T1Min: 30},
		},
		Provenance: "Modeled",
	}
}

func TestPositionAtChosenTimes(t *testing.T) {
	tests := []struct {
		t       float64
		pos     contract.XY
		leg     *int
		atStop  *string
		visited []string
	}{
		{0, contract.XY{0, 0}, ip(0), nil, []string{}},
		{5, contract.XY{50, 0}, ip(0), nil, []string{}},
		{10, contract.XY{100, 0}, nil, sp("s1"), []string{}},
		{14.9, contract.XY{100, 0}, nil, sp("s1"), []string{}},
		{15, contract.XY{100, 0}, ip(1), nil, []string{"s1"}},
		{20, contract.XY{100, 25}, ip(1), nil, []string{"s1"}},
		{22.5, contract.XY{100, 37.5}, ip(1), nil, []string{"s1"}},
		{30, contract.XY{100, 50}, nil, nil, []string{"s1", "s2"}},
	}
	for _, tc := range tests {
		s := New(toyRoute())
		s.Seek(tc.t)
		got := s.Snapshot()
		if math.Abs(got.Pos[0]-tc.pos[0]) > 1e-9 || math.Abs(got.Pos[1]-tc.pos[1]) > 1e-9 {
			t.Errorf("t=%v pos = %v, want %v", tc.t, got.Pos, tc.pos)
		}
		if !reflect.DeepEqual(got.Leg, tc.leg) || !reflect.DeepEqual(got.AtStop, tc.atStop) {
			t.Errorf("t=%v leg %v at_stop %v, want %v %v", tc.t, deref(got.Leg), derefS(got.AtStop), deref(tc.leg), derefS(tc.atStop))
		}
		if !reflect.DeepEqual(got.Visited, tc.visited) {
			t.Errorf("t=%v visited = %v, want %v", tc.t, got.Visited, tc.visited)
		}
	}
}

func TestBeforeStartHasNoLeg(t *testing.T) {
	snap := New(toyRoute()).Snapshot()
	if snap.Leg != nil || snap.Pos != (contract.XY{0, 0}) {
		t.Fatalf("before start: %+v", snap)
	}
}

func TestAdvanceIsDeterministicAndEmitsArrivals(t *testing.T) {
	a, b := New(toyRoute()), New(toyRoute())
	var evA []contract.Event
	for i := 0; i < 40; i++ { // many small steps
		evA = append(evA, a.Advance(0.75)...)
	}
	evB := b.Advance(100) // one big step
	if a.Snapshot().TMin != b.Snapshot().TMin || !a.Done() || !b.Done() {
		t.Fatal("both runs should end at the plan end")
	}
	want := []contract.Event{{Name: "arrived", TMin: 10}, {Name: "arrived", TMin: 25}}
	if !reflect.DeepEqual(evA, want) || !reflect.DeepEqual(evB, want) {
		t.Fatalf("events = %v / %v, want %v", evA, evB, want)
	}
}

func TestResetAndSeekClamp(t *testing.T) {
	s := New(toyRoute())
	s.Seek(999)
	if s.Snapshot().TMin != 30 || !s.Done() {
		t.Fatal("seek past the end clamps to the end")
	}
	s.Reset()
	if s.Snapshot().TMin != 0 || s.Done() || s.Snapshot().Leg != nil {
		t.Fatal("reset returns to before start")
	}
}

func TestFixtureRoute(t *testing.T) {
	b, err := os.ReadFile("../../../contracts/fixtures/route.json")
	if err != nil {
		t.Fatal(err)
	}
	var r contract.RouteResponse
	if err := json.Unmarshal(b, &r); err != nil {
		t.Fatal(err)
	}
	s := New(r)
	s.Seek(2)
	if got := s.Snapshot().Pos; got != (contract.XY{140, 120}) {
		t.Fatalf("fixture pos at t=2 = %v, want [140 120] as in ws-state.jsonl", got)
	}
}

func deref(p *int) any {
	if p == nil {
		return nil
	}
	return *p
}

func derefS(p *string) any {
	if p == nil {
		return nil
	}
	return *p
}
