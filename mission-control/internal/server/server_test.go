package server

import (
	"bytes"
	"encoding/json"
	"net"
	"net/http/httptest"
	"os"
	"testing"
	"time"

	"github.com/fasthttp/websocket"

	"github.com/ozyusuf/ariadne/mission-control/internal/contract"
)

func testServer(t *testing.T) *Server {
	t.Helper()
	cfg := DefaultConfig()
	cfg.ReplayPath = "../../../contracts/fixtures/ws-state.jsonl"
	s := New(cfg)
	t.Cleanup(s.Sessions.Close)
	return s
}

func TestHealth(t *testing.T) {
	resp, err := testServer(t).App.Test(httptest.NewRequest("GET", "/health", nil))
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

func fixtureSessionBody(t *testing.T) []byte {
	t.Helper()
	route, err := os.ReadFile("../../../contracts/fixtures/route.json")
	if err != nil {
		t.Fatal(err)
	}
	return []byte(`{"route":` + string(route) + `,"budget_min":240,"reserve_min":30,"dwell_min":20}`)
}

func post(t *testing.T, s *Server, path string, body []byte) (int, []byte) {
	t.Helper()
	req := httptest.NewRequest("POST", path, bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	resp, err := s.App.Test(req)
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	var buf bytes.Buffer
	_, _ = buf.ReadFrom(resp.Body)
	return resp.StatusCode, buf.Bytes()
}

func TestCreateSession(t *testing.T) {
	tests := []struct {
		name string
		body func(t *testing.T) []byte
		want int
	}{
		{"fixture route", fixtureSessionBody, 201},
		{"not json", func(*testing.T) []byte { return []byte("{") }, 400},
		{"unknown field", func(t *testing.T) []byte {
			return bytes.Replace(fixtureSessionBody(t), []byte(`"budget_min"`), []byte(`"extra":1,"budget_min"`), 1)
		}, 400},
		{"zero budget", func(t *testing.T) []byte {
			return bytes.Replace(fixtureSessionBody(t), []byte(`"budget_min":240`), []byte(`"budget_min":0`), 1)
		}, 400},
		{"no legs", func(*testing.T) []byte {
			return []byte(`{"route":{"legs":[],"timeline":[],"totals":{"distance_m":0,"walk_min":0,"dwell_min":0,"eva_min":0},"provenance":"Modeled"},"budget_min":1,"reserve_min":0,"dwell_min":0}`)
		}, 400},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			s := testServer(t)
			code, body := post(t, s, "/sessions", tc.body(t))
			if code != tc.want {
				t.Fatalf("status = %d (%s), want %d", code, body, tc.want)
			}
			if code == 201 {
				var got contract.SessionCreated
				if err := json.Unmarshal(body, &got); err != nil || got.ID == "" {
					t.Fatalf("body = %s", body)
				}
			}
		})
	}
}

// listen serves the app on a random local port and returns the ws base URL.
func listen(t *testing.T, s *Server) string {
	t.Helper()
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	go func() { _ = s.App.Listener(ln) }()
	t.Cleanup(func() { _ = s.App.Shutdown() })
	return "ws://" + ln.Addr().String()
}

func dial(t *testing.T, url string) *websocket.Conn {
	t.Helper()
	c, _, err := websocket.DefaultDialer.Dial(url, nil)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { c.Close() })
	_ = c.SetReadDeadline(time.Now().Add(5 * time.Second))
	return c
}

func createFixtureSession(t *testing.T, s *Server) string {
	t.Helper()
	code, body := post(t, s, "/sessions", fixtureSessionBody(t))
	if code != 201 {
		t.Fatalf("create session: %d %s", code, body)
	}
	var created contract.SessionCreated
	_ = json.Unmarshal(body, &created)
	return created.ID
}

func TestTwoClientsReceiveIdenticalState(t *testing.T) {
	s := testServer(t)
	base := listen(t, s)
	id := createFixtureSession(t, s)

	console := dial(t, base+"/ws?s="+id+"&role=console")
	cuff := dial(t, base+"/ws?s="+id+"&role=cuff")
	_ = console.WriteJSON(contract.Hello{Type: "hello", Role: "console"})
	_ = cuff.WriteJSON(contract.Hello{Type: "hello", Role: "cuff"})

	// The first frame each gets is its own join snapshot; after that both see the same broadcasts.
	for _, c := range []*websocket.Conn{console, cuff} {
		var st contract.State
		if err := c.ReadJSON(&st); err != nil || st.Type != "state" || st.Session != id {
			t.Fatalf("first frame = %+v, err %v", st, err)
		}
	}
	for i := 0; i < 3; i++ {
		_, a, err := console.ReadMessage()
		if err != nil {
			t.Fatal(err)
		}
		_, b, err := cuff.ReadMessage()
		if err != nil {
			t.Fatal(err)
		}
		if !bytes.Equal(a, b) {
			t.Fatalf("broadcast %d differs:\nconsole %s\ncuff    %s", i, a, b)
		}
	}
}

func TestWebSocketCloseCodes(t *testing.T) {
	s := testServer(t)
	base := listen(t, s)
	id := createFixtureSession(t, s)
	tests := []struct {
		name  string
		query string
		hello *contract.Hello
		want  int
	}{
		{"unknown session", "?s=nope&role=cuff", nil, 4404},
		{"bad role", "?s=" + id + "&role=pilot", nil, 4400},
		{"hello role mismatch", "?s=" + id + "&role=cuff", &contract.Hello{Type: "hello", Role: "console"}, 4400},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			c := dial(t, base+"/ws"+tc.query)
			if tc.hello != nil {
				_ = c.WriteJSON(tc.hello)
			}
			_, _, err := c.ReadMessage()
			ce, ok := err.(*websocket.CloseError)
			if !ok || ce.Code != tc.want {
				t.Fatalf("err = %v, want close %d", err, tc.want)
			}
		})
	}
}
