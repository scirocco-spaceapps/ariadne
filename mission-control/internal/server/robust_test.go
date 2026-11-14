package server

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/fasthttp/websocket"

	"github.com/ozyusuf/ariadne/mission-control/internal/contract"
)

func TestWindowLimiter(t *testing.T) {
	l := newWindowLimiter(2, time.Second)
	t0 := time.Now()
	if !l.allow("a", t0) || !l.allow("a", t0) || l.allow("a", t0) {
		t.Fatal("third call in the window must be refused")
	}
	if !l.allow("b", t0) {
		t.Fatal("keys are limited separately")
	}
	if !l.allow("a", t0.Add(time.Second)) {
		t.Fatal("a new window allows again")
	}
}

func TestEventsRateLimit(t *testing.T) {
	cfg := DefaultConfig()
	cfg.EventsPerWindow = 2
	cfg.EventWindow = time.Minute
	s := New(cfg)
	t.Cleanup(s.Sessions.Close)
	s.Planner = &fakePlanner{path: []contract.XY{{60, 60}}}
	id := createFixtureSession(t, s)
	codes := []int{}
	for _, b := range []string{`{"type":"storm_alert","lead_min":30}`, `{"type":"clear"}`, `{"type":"clear"}`} {
		code, _ := post(t, s, "/sessions/"+id+"/events", []byte(b))
		codes = append(codes, code)
	}
	if codes[0] != 200 || codes[1] != 200 || codes[2] != 429 {
		t.Fatalf("codes = %v, want 200 200 429", codes)
	}
}

func hello(t *testing.T, c *websocket.Conn, role string) contract.State {
	t.Helper()
	_ = c.WriteJSON(contract.Hello{Type: "hello", Role: role})
	var st contract.State
	if err := c.ReadJSON(&st); err != nil || st.Type != "state" {
		t.Fatalf("first frame %+v err %v", st, err)
	}
	return st
}

func TestReconnectGetsCurrentState(t *testing.T) {
	s := testServer(t)
	base := listen(t, s)
	id := createFixtureSession(t, s)
	post(t, s, "/sessions/"+id+"/control", []byte(`{"action":"seek","t_min":12}`))

	c := dial(t, base+"/ws?s="+id+"&role=cuff")
	hello(t, c, "cuff")
	c.Close()
	post(t, s, "/sessions/"+id+"/control", []byte(`{"action":"seek","t_min":26}`))

	again := dial(t, base+"/ws?s="+id+"&role=cuff")
	if st := hello(t, again, "cuff"); st.TMin != 26 || st.Session != id {
		t.Fatalf("after reconnect first state = t %v session %q, want the current t 26", st.TMin, st.Session)
	}
}

func TestPingKeepsIdleSocketOpen(t *testing.T) {
	cfg := DefaultConfig()
	cfg.PingInterval = 30 * time.Millisecond
	cfg.PongWait = 100 * time.Millisecond
	s := New(cfg)
	t.Cleanup(s.Sessions.Close)
	base := listen(t, s)
	id := createFixtureSession(t, s)
	c := dial(t, base+"/ws?s="+id+"&role=console")
	hello(t, c, "console")

	// Paused session: no state frames. Reading lets the client answer pings; well past PongWait
	// the server must not have dropped us.
	pings := 0
	c.SetPingHandler(func(data string) error {
		pings++
		return c.WriteControl(websocket.PongMessage, []byte(data), time.Now().Add(time.Second))
	})
	_ = c.SetReadDeadline(time.Now().Add(400 * time.Millisecond))
	if _, _, err := c.ReadMessage(); err == nil {
		t.Fatal("no frame expected while paused")
	}
	if pings < 3 {
		t.Fatalf("pings = %d, want several", pings)
	}
	if n := s.Sessions.Get(id).Clients(); n != 1 {
		t.Fatalf("clients = %d after idle period, want 1 (pongs keep it alive)", n)
	}
}

func TestSilentClientIsDropped(t *testing.T) {
	cfg := DefaultConfig()
	cfg.PingInterval = 20 * time.Millisecond
	cfg.PongWait = 60 * time.Millisecond
	s := New(cfg)
	t.Cleanup(s.Sessions.Close)
	base := listen(t, s)
	id := createFixtureSession(t, s)
	c := dial(t, base+"/ws?s="+id+"&role=cuff")
	hello(t, c, "cuff")
	// Not reading at all: pings stay unanswered, so the server gives up after PongWait.
	deadline := time.Now().Add(2 * time.Second)
	for s.Sessions.Get(id).Clients() != 0 {
		if time.Now().After(deadline) {
			t.Fatal("server kept a client that never answered pings")
		}
		time.Sleep(10 * time.Millisecond)
	}
}

func TestExpiredSessionClosesSockets(t *testing.T) {
	s := testServer(t)
	base := listen(t, s)
	id := createFixtureSession(t, s)
	c := dial(t, base+"/ws?s="+id+"&role=cuff")
	hello(t, c, "cuff")
	c.Close()
	// Let the server notice the close, then sweep as if two hours passed.
	time.Sleep(50 * time.Millisecond)
	if gone := s.Sessions.Sweep(time.Now().Add(3*time.Hour), 2*time.Hour); len(gone) != 1 {
		t.Fatalf("swept %v", gone)
	}
	if code, _ := post(t, s, "/sessions/"+id+"/control", []byte(`{"action":"start"}`)); code != 404 {
		t.Fatalf("expired session answers %d, want 404", code)
	}
}

func TestDemo90Script(t *testing.T) {
	cfg := DefaultConfig()
	cfg.Demo90 = Demo90Config{Speed: 60, LeadMin: 30, ClearAfter: 100 * time.Millisecond, Poll: 10 * time.Millisecond, Timeout: 30 * time.Second}
	s := New(cfg)
	t.Cleanup(s.Sessions.Close)
	s.Planner = &fakePlanner{path: []contract.XY{{60, 60}}}
	base := listen(t, s)
	id := createFixtureSession(t, s)
	c := dial(t, base+"/ws?s="+id+"&role=console")
	hello(t, c, "console")
	_ = c.SetReadDeadline(time.Now().Add(15 * time.Second))

	if code, _ := post(t, s, "/sessions/nope/script", []byte(`{"name":"demo90"}`)); code != 404 {
		t.Fatalf("unknown session: %d", code)
	}
	if code, _ := post(t, s, "/sessions/"+id+"/script", []byte(`{"name":"demo45"}`)); code != 400 {
		t.Fatalf("unknown script: %d", code)
	}
	if code, body := post(t, s, "/sessions/"+id+"/script", []byte(`{"name":"demo90"}`)); code != 200 {
		t.Fatalf("script: %d %s", code, body)
	}

	// Unattended: storm_alert, then arrived (home), then clear, with nothing else sent by the test.
	var names []string
	var last contract.State
	for len(names) == 0 || names[len(names)-1] != "clear" {
		_, b, err := c.ReadMessage()
		if err != nil {
			t.Fatalf("after events %v: %v", names, err)
		}
		var m struct {
			Type string `json:"type"`
			Name string `json:"name"`
		}
		_ = json.Unmarshal(b, &m)
		if m.Type == "event" {
			names = append(names, m.Name)
		} else {
			_ = json.Unmarshal(b, &last)
		}
	}
	alert := indexOf(names, "storm_alert")
	if alert < 0 || indexOf(names[alert:], "arrived") < 0 {
		t.Fatalf("events = %v, want storm_alert, arrived home, clear", names)
	}
	_ = c.ReadJSON(&last) // the state sent with the clear
	if last.Alert != nil || last.Running || last.Pos != (contract.XY{60, 60}) {
		t.Fatalf("final state = %+v, want home, stopped, alert cleared", last)
	}
}

func indexOf(xs []string, x string) int {
	for i, v := range xs {
		if v == x {
			return i
		}
	}
	return -1
}

func TestDemoAlertTime(t *testing.T) {
	// The fixture route's timeline: walk 0-4, dwell s1 4-24, walk 24-28, dwell s2 28-48.
	at := demoAlertTime(contract.RouteResponse{Timeline: []contract.TimelineItem{
		{Kind: "walk", T0Min: 0, T1Min: 4}, {Kind: "dwell", T0Min: 4, T1Min: 24},
		{Kind: "walk", T0Min: 24, T1Min: 28}, {Kind: "dwell", T0Min: 28, T1Min: 48},
	}})
	if at != 26 {
		t.Fatalf("alert at %v, want 26 (middle of the walk after the first dwell)", at)
	}
	if at = demoAlertTime(contract.RouteResponse{Timeline: []contract.TimelineItem{{Kind: "walk", T0Min: 0, T1Min: 10}}}); at != 5 {
		t.Fatalf("walk-only plan: alert at %v, want 5", at)
	}
}

func TestShutdown(t *testing.T) {
	s := New(DefaultConfig())
	listen(t, s)
	id := createFixtureSession(t, s)
	if err := s.Shutdown(time.Second); err != nil {
		t.Fatal(err)
	}
	if s.Sessions.Get(id) != nil || s.Sessions.Len() != 0 {
		t.Fatal("shutdown must stop every session")
	}
}
