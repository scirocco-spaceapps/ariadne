// Package server builds the mission-control HTTP app.
package server

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"sync"
	"time"

	"github.com/gofiber/contrib/websocket"
	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"

	"github.com/ozyusuf/ariadne/mission-control/internal/conditions"
	"github.com/ozyusuf/ariadne/mission-control/internal/contract"
	"github.com/ozyusuf/ariadne/mission-control/internal/planner"
	"github.com/ozyusuf/ariadne/mission-control/internal/session"
	"github.com/ozyusuf/ariadne/mission-control/internal/sim"
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
	// PlannerURL is the planner base URL for POST /abort (PLANNER_URL); empty skips the call.
	PlannerURL string
	// ParamsPath is model/params.json (MODEL_PARAMS_PATH); MEDAPath is content/conditions/meda.json (MEDA_PATH).
	ParamsPath string
	MEDAPath   string
	// NASAAPIKey is the api.nasa.gov key for DONKI (NASA_API_KEY); empty uses the rate-limited DEMO_KEY.
	NASAAPIKey string
	// DONKIBaseURL overrides the DONKI endpoint (tests).
	DONKIBaseURL string

	// SessionTTL removes a session nobody listens to and whose clock is stopped (SESSION_TTL).
	SessionTTL time.Duration
	// PingInterval and PongWait keep WebSockets alive and drop dead ones.
	PingInterval time.Duration
	PongWait     time.Duration
	// EventsPerWindow is how many /events calls one session may make per EventWindow.
	EventsPerWindow int
	EventWindow     time.Duration
	// Demo90 drives POST /sessions/{id}/script {"name":"demo90"}.
	Demo90 Demo90Config
}

// DefaultConfig works from the mission-control folder of a repo checkout.
func DefaultConfig() Config {
	return Config{
		WebOrigins:      "http://localhost:5173",
		ParamsPath:      "../model/params.json",
		MEDAPath:        "../content/conditions/meda.json",
		DONKIBaseURL:    conditions.DONKIBaseURL,
		SessionTTL:      2 * time.Hour,
		PingInterval:    20 * time.Second,
		PongWait:        60 * time.Second,
		EventsPerWindow: 10,
		EventWindow:     10 * time.Second,
		Demo90:          DefaultDemo90(),
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
	Planner  interface {
		Abort(ctx context.Context, from contract.XY) ([]contract.XY, float64, error)
	}
	Conditions *conditions.Service
	Log        *slog.Logger
	cfg        Config

	events    *windowLimiter // /events calls per session
	scriptsMu sync.Mutex
	scripts   map[string]*scriptRun // running script per session id
}

// New returns the server with all routes registered and the session janitor running.
func New(cfg Config) *Server {
	def := DefaultConfig()
	if cfg.PingInterval <= 0 {
		cfg.PingInterval = def.PingInterval
	}
	if cfg.PongWait <= 0 {
		cfg.PongWait = def.PongWait
	}
	if cfg.Demo90 == (Demo90Config{}) {
		cfg.Demo90 = def.Demo90
	}
	s := &Server{
		App:      fiber.New(fiber.Config{AppName: "ariadne-mission-control", DisableStartupMessage: true}),
		Sessions: session.NewStore(),
		Planner:  planner.New(cfg.PlannerURL),
		Log:      slog.Default(),
		cfg:      cfg,
		scripts:  make(map[string]*scriptRun),
		events:   newWindowLimiter(max(cfg.EventsPerWindow, 1), max(cfg.EventWindow, time.Second)),
	}
	key := cfg.NASAAPIKey
	if key == "" {
		s.Log.Warn("NASA_API_KEY is not set; DONKI uses DEMO_KEY (30 requests per hour)")
		key = "DEMO_KEY"
	}
	s.Conditions = conditions.New(conditions.Config{
		ParamsPath: cfg.ParamsPath,
		MEDAPath:   cfg.MEDAPath,
		DONKI:      &conditions.DONKI{BaseURL: cfg.DONKIBaseURL, APIKey: key, HTTP: &http.Client{Timeout: 10 * time.Second}},
	})
	if cfg.SessionTTL > 0 {
		s.Sessions.StartJanitor(cfg.SessionTTL, min(cfg.SessionTTL, time.Minute), func(ids []string) {
			for _, id := range ids {
				s.stopScript(id)
				s.Log.Info("session expired", "session", id)
			}
		})
	}

	s.App.Use(s.logRequests)
	s.App.Use(cors.New(cors.Config{AllowOrigins: cfg.WebOrigins}))
	s.App.Get("/health", func(c *fiber.Ctx) error {
		return c.JSON(Health{Status: "ok", Service: "mission-control"})
	})
	s.App.Get("/conditions", func(c *fiber.Ctx) error {
		return c.JSON(s.Conditions.Get(c.Context()))
	})
	s.App.Post("/sessions", s.createSession)
	s.App.Post("/sessions/:id/control", s.controlSession)
	s.App.Post("/sessions/:id/events", s.sessionEvent)
	s.App.Post("/sessions/:id/script", s.sessionScript)
	s.App.Use("/ws", func(c *fiber.Ctx) error {
		if websocket.IsWebSocketUpgrade(c) {
			return c.Next()
		}
		return fiber.ErrUpgradeRequired
	})
	s.App.Get("/ws", websocket.New(s.serveWS))
	return s
}

// Shutdown stops accepting requests, waits up to timeout for open ones, then stops every session.
func (s *Server) Shutdown(timeout time.Duration) error {
	err := s.App.ShutdownWithTimeout(timeout)
	s.scriptsMu.Lock()
	for id, run := range s.scripts {
		run.cancel()
		delete(s.scripts, id)
	}
	s.scriptsMu.Unlock()
	s.Sessions.Close()
	return err
}

func (s *Server) logRequests(c *fiber.Ctx) error {
	start := time.Now()
	err := c.Next()
	status := c.Response().StatusCode()
	if err != nil {
		var fe *fiber.Error
		if errors.As(err, &fe) {
			status = fe.Code
		}
	}
	s.Log.Info("request", "method", c.Method(), "path", c.Path(), "status", status, "ms", time.Since(start).Milliseconds())
	return err
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
	sess := s.Sessions.Create(sim.New(body.Route), false)
	s.Log.Info("session created", "session", sess.ID, "legs", len(body.Route.Legs), "eva_min", body.Route.Totals.EvaMin)
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

// sessionControl is the POST /sessions/{id}/control body (schema SessionControl).
type sessionControl struct {
	Action string   `json:"action"`
	TMin   *float64 `json:"t_min"`
	Speed  *float64 `json:"speed"`
}

// controllable is what /control needs from an engine beyond session.Engine.
type controllable interface {
	Seek(t float64)
	Reset()
}

func (s *Server) controlSession(c *fiber.Ctx) error {
	sess := s.Sessions.Get(c.Params("id"))
	if sess == nil {
		return notFound(c)
	}
	var body sessionControl
	dec := json.NewDecoder(bytes.NewReader(c.Body()))
	dec.DisallowUnknownFields()
	if err := dec.Decode(&body); err != nil {
		return badRequest(c, "invalid body: "+err.Error())
	}
	switch body.Action {
	case "start", "pause", "reset":
	case "seek":
		if body.TMin == nil {
			return badRequest(c, "seek needs t_min")
		}
	default:
		return badRequest(c, "action must be start, pause, reset or seek")
	}
	if body.TMin != nil && *body.TMin < 0 {
		return badRequest(c, "t_min must be >= 0")
	}
	if body.Speed != nil && *body.Speed <= 0 {
		return badRequest(c, "speed must be > 0")
	}
	if body.Action == "reset" || body.Action == "seek" {
		s.stopScript(sess.ID) // a manual jump ends a running demo script
	}
	s.control(sess, body)
	return c.JSON(contract.Ack{OK: true})
}

func (s *Server) control(sess *session.Session, body sessionControl) {
	sess.Update(func(ctl *session.Control) []contract.Event {
		eng, _ := ctl.Engine().(controllable)
		switch body.Action {
		case "start":
			if body.Speed != nil {
				ctl.SetSpeed(*body.Speed)
			}
			ctl.SetRunning(!ctl.Engine().Done())
		case "pause":
			ctl.SetRunning(false)
		case "reset":
			if eng != nil {
				eng.Reset()
			}
			ctl.SetRunning(false)
		case "seek":
			if eng != nil {
				eng.Seek(*body.TMin)
			}
			if body.Speed != nil {
				ctl.SetSpeed(*body.Speed)
			}
			if ctl.Engine().Done() {
				ctl.SetRunning(false)
			}
		}
		return nil
	})
	s.Log.Info("session control", "session", sess.ID, "action", body.Action)
}

// sessionEvent is the POST /sessions/{id}/events body (schema SessionEvent).
type sessionEvent struct {
	Type      string        `json:"type"`
	LeadMin   *float64      `json:"lead_min"`
	AbortPath []contract.XY `json:"abort_path"`
}

// alertable is what /events needs from an engine beyond session.Engine.
type alertable interface {
	StartAlert(leadMin float64, path []contract.XY, timeMin float64) error
	Clear() error
}

// errBadEvent marks an event the session cannot take (answered with 400).
var errBadEvent = errors.New("bad event")

func (s *Server) sessionEvent(c *fiber.Ctx) error {
	sess := s.Sessions.Get(c.Params("id"))
	if sess == nil {
		return notFound(c)
	}
	if !s.events.allow(sess.ID, time.Now()) {
		return c.Status(fiber.StatusTooManyRequests).JSON(contract.Error{Detail: "too many events for this session; wait a few seconds"})
	}
	var body sessionEvent
	dec := json.NewDecoder(bytes.NewReader(c.Body()))
	dec.DisallowUnknownFields()
	if err := dec.Decode(&body); err != nil {
		return badRequest(c, "invalid body: "+err.Error())
	}
	if err := s.applyEvent(c.Context(), sess, body); err != nil {
		return badRequest(c, err.Error())
	}
	return c.JSON(contract.Ack{OK: true})
}

// applyEvent raises or clears an alert, as POST /events and the demo script both do.
func (s *Server) applyEvent(ctx context.Context, sess *session.Session, ev sessionEvent) error {
	var apply func(eng alertable) error
	switch ev.Type {
	case contract.EventStormAlert:
		if ev.LeadMin == nil || *ev.LeadMin < 0 {
			return fmt.Errorf("%w: storm_alert needs lead_min >= 0", errBadEvent)
		}
		if st := sess.State(); st.Alert != nil {
			return fmt.Errorf("%w: an alert is already active", errBadEvent)
		}
		// The planner call happens outside the session lock; the engine prepends the position
		// reached meanwhile, so the path still starts at the astronaut.
		path, timeMin, err := s.Planner.Abort(ctx, sess.State().Pos)
		if err != nil {
			s.Log.Warn("planner /abort failed, using fallback path", "session", sess.ID, "err", err)
			path, timeMin = ev.AbortPath, 0
		}
		apply = func(eng alertable) error { return eng.StartAlert(*ev.LeadMin, path, timeMin) }
	case contract.EventClear:
		apply = func(eng alertable) error { return eng.Clear() }
	default:
		return fmt.Errorf("%w: type must be storm_alert or clear", errBadEvent)
	}

	var applyErr error
	sess.Update(func(ctl *session.Control) []contract.Event {
		eng, ok := ctl.Engine().(alertable)
		if !ok {
			applyErr = fmt.Errorf("%w: session does not support events", errBadEvent)
			return nil
		}
		if applyErr = apply(eng); applyErr != nil {
			return nil
		}
		return []contract.Event{{Name: ev.Type, TMin: ctl.Engine().Snapshot().TMin}}
	})
	if applyErr == nil {
		s.Log.Info("session event", "session", sess.ID, "type", ev.Type)
	}
	return applyErr
}

func badRequest(c *fiber.Ctx, msg string) error {
	return c.Status(fiber.StatusBadRequest).JSON(contract.Error{Detail: msg})
}

func notFound(c *fiber.Ctx) error {
	return c.Status(fiber.StatusNotFound).JSON(contract.Error{Detail: "unknown session"})
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

	// A reconnecting client just joins again: its first frame is the current state (no replay).
	client := session.NewClient(role)
	sess.Join(client)
	defer sess.Leave(client)
	s.Log.Info("ws joined", "session", sess.ID, "role", role)
	defer s.Log.Info("ws left", "session", sess.ID, "role", role)

	// Clients send nothing after hello; reading detects the close and handles pongs.
	pongWait := s.cfg.PongWait
	_ = conn.SetReadDeadline(time.Now().Add(pongWait))
	conn.SetPongHandler(func(string) error { return conn.SetReadDeadline(time.Now().Add(pongWait)) })
	gone := make(chan struct{})
	go func() {
		defer close(gone)
		for {
			if _, _, err := conn.ReadMessage(); err != nil {
				return
			}
		}
	}()

	ping := time.NewTicker(s.cfg.PingInterval)
	defer ping.Stop()
	for {
		select {
		case frame, ok := <-client.Send:
			if !ok {
				return
			}
			if err := conn.WriteMessage(websocket.TextMessage, frame); err != nil {
				return
			}
		case <-ping.C:
			if err := conn.WriteControl(websocket.PingMessage, nil, time.Now().Add(5*time.Second)); err != nil {
				return
			}
		case <-sess.Done():
			closeWith(conn, websocket.CloseGoingAway, "session ended")
			return
		case <-gone:
			return
		}
	}
}

func closeWith(conn *websocket.Conn, code int, reason string) {
	msg := websocket.FormatCloseMessage(code, reason)
	_ = conn.WriteControl(websocket.CloseMessage, msg, time.Now().Add(time.Second))
}
