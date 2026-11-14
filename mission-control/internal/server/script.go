package server

import (
	"bytes"
	"context"
	"encoding/json"
	"math"
	"time"

	"github.com/gofiber/fiber/v2"

	"github.com/ozyusuf/ariadne/mission-control/internal/contract"
	"github.com/ozyusuf/ariadne/mission-control/internal/session"
)

// Demo90Config shapes the scripted rehearsal. Every value is a scenario setting (Simulation),
// not a measurement.
type Demo90Config struct {
	Speed      float64       // simulated minutes per real second
	LeadMin    float64       // storm lead time announced with the alert
	ClearAfter time.Duration // real time between arriving home and the clear
	Poll       time.Duration // how often the script looks at the session
	Timeout    time.Duration // a script never runs longer than this
}

// DefaultDemo90 fits the rehearsal into about 90 seconds on a typical route.
func DefaultDemo90() Demo90Config {
	return Demo90Config{Speed: 6, LeadMin: 30, ClearAfter: 6 * time.Second, Poll: 100 * time.Millisecond, Timeout: 10 * time.Minute}
}

// routed is implemented by engines that expose their planned route.
type routed interface {
	Route() contract.RouteResponse
}

// scriptRun is one running script; its pointer identifies it in Server.scripts.
type scriptRun struct{ cancel context.CancelFunc }

// sessionScript is the POST /sessions/{id}/script body (schema SessionScript).
type sessionScript struct {
	Name string `json:"name"`
}

func (s *Server) sessionScript(c *fiber.Ctx) error {
	sess := s.Sessions.Get(c.Params("id"))
	if sess == nil {
		return notFound(c)
	}
	var body sessionScript
	dec := json.NewDecoder(bytes.NewReader(c.Body()))
	dec.DisallowUnknownFields()
	if err := dec.Decode(&body); err != nil {
		return badRequest(c, "invalid body: "+err.Error())
	}
	if body.Name != "demo90" {
		return badRequest(c, "unknown script; the only one is demo90")
	}
	var route contract.RouteResponse
	ok := false
	sess.Update(func(ctl *session.Control) []contract.Event {
		if r, isRouted := ctl.Engine().(routed); isRouted {
			route, ok = r.Route(), true
		}
		return nil
	})
	if !ok {
		return badRequest(c, "session cannot run scripts")
	}

	s.stopScript(sess.ID)
	ctx, cancel := context.WithTimeout(context.Background(), s.cfg.Demo90.Timeout)
	run := &scriptRun{cancel: cancel}
	s.scriptsMu.Lock()
	s.scripts[sess.ID] = run
	s.scriptsMu.Unlock()
	go func() {
		defer cancel()
		s.runDemo90(ctx, sess, demoAlertTime(route))
		s.scriptsMu.Lock()
		if s.scripts[sess.ID] == run { // not replaced by a newer script meanwhile
			delete(s.scripts, sess.ID)
		}
		s.scriptsMu.Unlock()
	}()
	return c.JSON(contract.Ack{OK: true})
}

func (s *Server) stopScript(id string) {
	s.scriptsMu.Lock()
	defer s.scriptsMu.Unlock()
	if run, ok := s.scripts[id]; ok {
		run.cancel()
		delete(s.scripts, id)
	}
}

// demoAlertTime is halfway through the first walk after the first finished dwell, so the
// rehearsal shows a visited stop before the alert. Without such a walk: half the plan.
func demoAlertTime(r contract.RouteResponse) float64 {
	dwellDone := false
	end := 0.0
	for _, it := range r.Timeline {
		end = math.Max(end, it.T1Min)
		if it.Kind == "dwell" {
			dwellDone = true
		} else if dwellDone {
			return (it.T0Min + it.T1Min) / 2
		}
	}
	return end / 2
}

// runDemo90: reset, start, raise a storm alert at alertAt, let the astronaut walk home, clear.
func (s *Server) runDemo90(ctx context.Context, sess *session.Session, alertAt float64) {
	cfg := s.cfg.Demo90
	speed := cfg.Speed
	s.control(sess, sessionControl{Action: "reset"})
	s.control(sess, sessionControl{Action: "start", Speed: &speed})
	s.Log.Info("script started", "session", sess.ID, "name", "demo90", "alert_at_min", alertAt)

	tick := time.NewTicker(cfg.Poll)
	defer tick.Stop()
	alerted := false
	var homeAt time.Time
	for {
		select {
		case <-ctx.Done():
			s.Log.Info("script stopped", "session", sess.ID, "reason", ctx.Err())
			return
		case <-sess.Done():
			return
		case now := <-tick.C:
			st := sess.State()
			switch {
			case !alerted && st.TMin >= alertAt:
				lead := cfg.LeadMin
				if err := s.applyEvent(ctx, sess, sessionEvent{Type: contract.EventStormAlert, LeadMin: &lead}); err != nil {
					s.Log.Warn("script alert failed", "session", sess.ID, "err", err)
					return
				}
				alerted = true
			case !alerted && !st.Running:
				s.Log.Info("script ended before the alert", "session", sess.ID)
				return
			case alerted && atHome(st):
				if homeAt.IsZero() {
					homeAt = now
				} else if now.Sub(homeAt) >= cfg.ClearAfter {
					if err := s.applyEvent(ctx, sess, sessionEvent{Type: contract.EventClear}); err != nil {
						s.Log.Warn("script clear failed", "session", sess.ID, "err", err)
					}
					s.Log.Info("script finished", "session", sess.ID, "name", "demo90")
					return
				}
			}
		}
	}
}

// atHome: the alert is active, the clock has stopped and the astronaut stands at the abort path's end.
func atHome(st contract.State) bool {
	if st.Alert == nil || st.Running || len(st.AbortPath) == 0 {
		return false
	}
	end := st.AbortPath[len(st.AbortPath)-1]
	return math.Hypot(st.Pos[0]-end[0], st.Pos[1]-end[1]) < 1e-6
}
