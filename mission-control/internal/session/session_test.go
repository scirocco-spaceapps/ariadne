package session

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/ozyusuf/ariadne/mission-control/internal/contract"
)

// fakeEngine moves along x at 1 m per simulated minute and emits "arrived" at t = 10.
type fakeEngine struct{ t float64 }

func (f *fakeEngine) Advance(dt float64) []contract.Event {
	before := f.t
	f.t = min(f.t+dt, 10)
	if before < 10 && f.t == 10 {
		return []contract.Event{{Name: contract.EventArrived, TMin: 10}}
	}
	return nil
}
func (f *fakeEngine) Snapshot() Snapshot { return Snapshot{TMin: f.t, Pos: contract.XY{f.t, 0}} }
func (f *fakeEngine) Done() bool         { return f.t >= 10 }

func drain(c *Client) []map[string]any {
	var out []map[string]any
	for {
		select {
		case b, ok := <-c.Send:
			if !ok {
				return out
			}
			var m map[string]any
			_ = json.Unmarshal(b, &m)
			out = append(out, m)
		default:
			return out
		}
	}
}

func TestHub(t *testing.T) {
	tests := []struct {
		name string
		// run gets a fresh session with clients a and b already joined and drained.
		run          func(s *Session, a, b *Client)
		wantA, wantB []string // message types (state, or event name) each client receives
	}{
		{
			name:  "broadcast reaches every client",
			run:   func(s *Session, a, b *Client) { s.Update(func(*Control) []contract.Event { return nil }) },
			wantA: []string{"state"}, wantB: []string{"state"},
		},
		{
			name:  "left client receives nothing",
			run:   func(s *Session, a, b *Client) { s.Leave(b); s.Update(func(*Control) []contract.Event { return nil }) },
			wantA: []string{"state"}, wantB: nil,
		},
		{
			name: "events come before the state",
			run: func(s *Session, a, b *Client) {
				s.Update(func(*Control) []contract.Event {
					return []contract.Event{{Name: contract.EventStormAlert, TMin: 3}}
				})
			},
			wantA: []string{"storm_alert", "state"}, wantB: []string{"storm_alert", "state"},
		},
		{
			name:  "paused clock does not broadcast",
			run:   func(s *Session, a, b *Client) { s.tick(time.Second) },
			wantA: nil, wantB: nil,
		},
		{
			name: "running tick advances, emits and stops at done",
			run: func(s *Session, a, b *Client) {
				s.Update(func(c *Control) []contract.Event { c.SetRunning(true); c.SetSpeed(20); return nil })
				drain(a)
				drain(b)
				s.tick(time.Second)
			},
			wantA: []string{"arrived", "state"}, wantB: []string{"arrived", "state"},
		},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			s := newSession("t", &fakeEngine{})
			a, b := NewClient(contract.RoleConsole), NewClient(contract.RoleCuff)
			s.Join(a)
			s.Join(b)
			if n := s.Clients(); n != 2 {
				t.Fatalf("clients = %d, want 2", n)
			}
			if got := drain(a); len(got) != 1 || got[0]["type"] != "state" {
				t.Fatalf("join should send one state, got %v", got)
			}
			drain(b)
			tc.run(s, a, b)
			for _, c := range []struct {
				name string
				cl   *Client
				want []string
			}{{"a", a, tc.wantA}, {"b", b, tc.wantB}} {
				got := drain(c.cl)
				if len(got) != len(c.want) {
					t.Fatalf("%s got %d messages %v, want %v", c.name, len(got), got, c.want)
				}
				for i, m := range got {
					kind, _ := m["type"].(string)
					if kind == "event" {
						kind, _ = m["name"].(string)
					}
					if kind != c.want[i] {
						t.Fatalf("%s message %d = %q, want %q", c.name, i, kind, c.want[i])
					}
				}
			}
		})
	}
}

func TestRunningTickStopsWhenDone(t *testing.T) {
	s := newSession("t", &fakeEngine{})
	s.Update(func(c *Control) []contract.Event { c.SetRunning(true); c.SetSpeed(20); return nil })
	s.tick(time.Second)
	st := s.State()
	if st.Running || st.TMin != 10 {
		t.Fatalf("state = running %v t %v, want stopped at 10", st.Running, st.TMin)
	}
	if st.Visited == nil || st.Provenance != "Simulation" || st.Session != "t" {
		t.Fatalf("state fields wrong: %+v", st)
	}
}

func TestSlowClientIsDropped(t *testing.T) {
	s := newSession("t", &fakeEngine{})
	c := &Client{Role: contract.RoleCuff, Send: make(chan []byte, 1)}
	s.Join(c) // fills the buffer
	s.Update(func(*Control) []contract.Event { return nil })
	if s.Clients() != 0 {
		t.Fatal("slow client should be dropped")
	}
	<-c.Send
	if _, ok := <-c.Send; ok {
		t.Fatal("dropped client's channel should be closed")
	}
}
