// Package server builds the mission-control HTTP app.
package server

import (
	"bytes"
	"encoding/json"
	"fmt"
	"os"
	"time"

	"github.com/gofiber/contrib/websocket"
	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"

	"github.com/ozyusuf/ariadne/mission-control/internal/contract"
	"github.com/ozyusuf/ariadne/mission-control/internal/session"
)

// Health is the /health response (schema Health in contracts/openapi.yaml).
type Health struct {
	Status  string `json:"status"`
	Service string `json:"service"`
}

// Config holds the settings read from the environment in main.
type Config struct {
	// WebOrigins is the CORS allow list, comma-separated (WEB_ORIGIN).
	WebOrigins string
	// ReplayPath is the ws-state.jsonl file new sessions replay until the simulator lands (REPLAY_PATH).
	ReplayPath string
}

// DefaultConfig works from the mission-control folder of a repo checkout.
func DefaultConfig() Config {
	return Config{
		WebOrigins: "http://localhost:5173",
		ReplayPath: "../contracts/fixtures/ws-state.jsonl",
	}
}

// Close codes from ws-messages.md.
const (
	closeUnknownSession = 4404
	closeBadRole        = 4400
	helloTimeout        = 10 * time.Second
)

// Server is the Fiber app plus the session store behind it.
type Server struct {
	App      *fiber.App
	Sessions *session.Store
	cfg      Config
}

// New returns the server with all routes registered.
func New(cfg Config) *Server {
	s := &Server{
		App:      fiber.New(fiber.Config{AppName: "ariadne-mission-control"}),
		Sessions: session.NewStore(),
		cfg:      cfg,
	}
	s.App.Use(cors.New(cors.Config{AllowOrigins: cfg.WebOrigins}))
	s.App.Get("/health", func(c *fiber.Ctx) error {
		return c.JSON(Health{Status: "ok", Service: "mission-control"})
	})
	s.App.Post("/sessions", s.createSession)
	s.App.Use("/ws", func(c *fiber.Ctx) error {
		if websocket.IsWebSocketUpgrade(c) {
			return c.Next()
		}
		return fiber.ErrUpgradeRequired
	})
	s.App.Get("/ws", websocket.New(s.serveWS))
	return s
}

func (s *Server) createSession(c *fiber.Ctx) error {
	var body contract.SessionCreate
	dec := json.NewDecoder(bytes.NewReader(c.Body()))
	dec.DisallowUnknownFields()
	if err := dec.Decode(&body); err != nil {
		return badRequest(c, "invalid body: "+err.Error())
	}
	if err := validateSession(body); err != nil {
		return badRequest(c, err.Error())
	}
	f, err := os.Open(s.cfg.ReplayPath)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "replay file: "+err.Error())
	}
	defer f.Close()
	engine, err := session.LoadReplay(f)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "replay file: "+err.Error())
	}
	sess := s.Sessions.Create(engine, true)
	return c.Status(fiber.StatusCreated).JSON(contract.SessionCreated{ID: sess.ID})
}

func validateSession(b contract.SessionCreate) error {
	if b.BudgetMin <= 0 {
		return fmt.Errorf("budget_min must be > 0")
	}
	if b.ReserveMin < 0 || b.DwellMin < 0 {
		return fmt.Errorf("reserve_min and dwell_min must be >= 0")
	}
	r := b.Route
	if len(r.Legs) == 0 {
		return fmt.Errorf("route has no legs")
	}
	for i, l := range r.Legs {
		if len(l.Path) < 2 {
			return fmt.Errorf("leg %d: path needs at least 2 points", i)
		}
	}
	if len(r.Timeline) == 0 {
		return fmt.Errorf("route has no timeline")
	}
	prev := 0.0
	for i, it := range r.Timeline {
		if it.T0Min < prev-1e-9 || it.T1Min < it.T0Min {
			return fmt.Errorf("timeline %d: times must be ordered", i)
		}
		prev = it.T1Min
		switch it.Kind {
		case "walk":
			if it.Leg == nil || *it.Leg < 0 || *it.Leg >= len(r.Legs) {
				return fmt.Errorf("timeline %d: walk needs a valid leg", i)
			}
		case "dwell":
			if it.Stop == nil || *it.Stop == "" {
				return fmt.Errorf("timeline %d: dwell needs a stop", i)
			}
		default:
			return fmt.Errorf("timeline %d: kind must be walk or dwell", i)
		}
	}
	return nil
}

func badRequest(c *fiber.Ctx, msg string) error {
	return c.Status(fiber.StatusBadRequest).JSON(contract.Error{Detail: msg})
}

func (s *Server) serveWS(conn *websocket.Conn) {
	sess := s.Sessions.Get(conn.Query("s"))
	if sess == nil {
		closeWith(conn, closeUnknownSession, "unknown session")
		return
	}
	role := conn.Query("role")
	if role != contract.RoleConsole && role != contract.RoleCuff {
		closeWith(conn, closeBadRole, "role must be console or cuff")
		return
	}

	_ = conn.SetReadDeadline(time.Now().Add(helloTimeout))
	var hello contract.Hello
	if err := conn.ReadJSON(&hello); err != nil || hello.Type != "hello" || hello.Role != role {
		closeWith(conn, closeBadRole, "first frame must be hello with the query role")
		return
	}
	_ = conn.SetReadDeadline(time.Time{})

	client := session.NewClient(role)
	sess.Join(client)
	defer sess.Leave(client)

	// Clients send nothing after hello; reading only detects the close.
	gone := make(chan struct{})
	go func() {
		defer close(gone)
		for {
			if _, _, err := conn.ReadMessage(); err != nil {
				return
			}
		}
	}()

	for {
		select {
		case frame, ok := <-client.Send:
			if !ok {
				return
			}
			if err := conn.WriteMessage(websocket.TextMessage, frame); err != nil {
				return
			}
		case <-gone:
			return
		}
	}
}

func closeWith(conn *websocket.Conn, code int, reason string) {
	msg := websocket.FormatCloseMessage(code, reason)
	_ = conn.WriteControl(websocket.CloseMessage, msg, time.Now().Add(time.Second))
}
