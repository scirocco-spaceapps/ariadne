package server

import (
	"context"
	"errors"
	"reflect"
	"testing"

	"github.com/ozyusuf/ariadne/mission-control/internal/contract"
)

type fakePlanner struct {
	path []contract.XY
	err  error
}

func (f *fakePlanner) Abort(_ context.Context, _ contract.XY) ([]contract.XY, float64, error) {
	return f.path, 2, f.err
}

func TestEvents(t *testing.T) {
	down := errors.New("down")
	tests := []struct {
		name     string
		planner  *fakePlanner
		calls    []string // bodies posted in order
		codes    []int
		wantPath []contract.XY // abort_path after the calls; nil = no alert
	}{
		{"planner path", &fakePlanner{path: []contract.XY{{60, 60}}},
			[]string{`{"type":"storm_alert","lead_min":30}`}, []int{200}, []contract.XY{{140, 120}, {60, 60}}},
		{"planner fails, body path", &fakePlanner{err: down},
			[]string{`{"type":"storm_alert","lead_min":30,"abort_path":[[10,10],[60,60]]}`}, []int{200},
			[]contract.XY{{140, 120}, {10, 10}, {60, 60}}},
		{"planner fails, no body path: retrace", &fakePlanner{err: down},
			[]string{`{"type":"storm_alert","lead_min":30}`}, []int{200}, []contract.XY{{140, 120}, {60, 60}}},
		{"alert needs lead_min", &fakePlanner{}, []string{`{"type":"storm_alert"}`}, []int{400}, nil},
		{"unknown type", &fakePlanner{}, []string{`{"type":"rain"}`}, []int{400}, nil},
		{"clear without alert", &fakePlanner{}, []string{`{"type":"clear"}`}, []int{400}, nil},
		{"double alert keeps the first", &fakePlanner{path: []contract.XY{{60, 60}}},
			[]string{`{"type":"storm_alert","lead_min":30}`, `{"type":"storm_alert","lead_min":9}`}, []int{200, 400},
			[]contract.XY{{140, 120}, {60, 60}}},
		{"alert then clear", &fakePlanner{path: []contract.XY{{60, 60}}},
			[]string{`{"type":"storm_alert","lead_min":30}`, `{"type":"clear"}`}, []int{200, 200}, nil},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			s := testServer(t)
			s.Planner = tc.planner
			id := createFixtureSession(t, s)
			post(t, s, "/sessions/"+id+"/control", []byte(`{"action":"seek","t_min":2}`))
			for i, b := range tc.calls {
				if code, body := post(t, s, "/sessions/"+id+"/events", []byte(b)); code != tc.codes[i] {
					t.Fatalf("call %d: status %d (%s), want %d", i, code, body, tc.codes[i])
				}
			}
			st := s.Sessions.Get(id).State()
			if !reflect.DeepEqual(st.AbortPath, tc.wantPath) {
				t.Fatalf("abort_path = %v, want %v", st.AbortPath, tc.wantPath)
			}
			if (st.Alert != nil) != (tc.wantPath != nil) {
				t.Fatalf("alert = %+v", st.Alert)
			}
			if st.Alert != nil && (st.Alert.LeadMin != 30 || st.Alert.SinceT != 2) {
				t.Fatalf("alert = %+v, want lead 30 since 2", st.Alert)
			}
		})
	}
	if code, _ := post(t, testServer(t), "/sessions/nope/events", []byte(`{"type":"clear"}`)); code != 404 {
		t.Fatalf("unknown session: %d", code)
	}
}

func TestAlertOverWebSocket(t *testing.T) {
	s := testServer(t)
	s.Planner = &fakePlanner{path: []contract.XY{{60, 60}}}
	base := listen(t, s)
	id := createFixtureSession(t, s)
	post(t, s, "/sessions/"+id+"/control", []byte(`{"action":"seek","t_min":2}`))
	c := dial(t, base+"/ws?s="+id+"&role=cuff")
	_ = c.WriteJSON(contract.Hello{Type: "hello", Role: "cuff"})
	var st contract.State
	_ = c.ReadJSON(&st)

	post(t, s, "/sessions/"+id+"/events", []byte(`{"type":"storm_alert","lead_min":30}`))
	var ev contract.Event
	if err := c.ReadJSON(&ev); err != nil || ev.Type != "event" || ev.Name != "storm_alert" || ev.TMin != 2 {
		t.Fatalf("event = %+v err %v", ev, err)
	}
	if err := c.ReadJSON(&st); err != nil || st.Alert == nil || st.Leg != nil {
		t.Fatalf("state after alert = %+v err %v", st, err)
	}
	// The fake planner says 2 min home; at speed 6 the arrival comes within a second.
	post(t, s, "/sessions/"+id+"/control", []byte(`{"action":"start"}`))
	for {
		var m map[string]any
		if err := c.ReadJSON(&m); err != nil {
			t.Fatal(err)
		}
		if m["type"] == "event" && m["name"] == "arrived" {
			break
		}
	}
	if err := c.ReadJSON(&st); err != nil || st.Running || st.Pos != (contract.XY{60, 60}) {
		t.Fatalf("state after arrival = %+v err %v", st, err)
	}
}
