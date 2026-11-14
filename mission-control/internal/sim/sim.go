// Package sim walks a simulated astronaut along a planned route. Everything it produces is
// Simulation. The run is a pure function of simulated time, so it is deterministic for a plan.
package sim

import (
	"math"

	"github.com/ozyusuf/ariadne/mission-control/internal/contract"
	"github.com/ozyusuf/ariadne/mission-control/internal/session"
)

// Sim implements session.Engine for one planned route.
type Sim struct {
	route   contract.RouteResponse
	cum     [][]float64 // cumulative length along each leg path, metres
	end     float64     // end of the timeline, minutes
	t       float64
	started bool
}

// New returns a simulator at t = 0, before start. The route must be validated first.
func New(route contract.RouteResponse) *Sim {
	s := &Sim{route: route, cum: make([][]float64, len(route.Legs))}
	for i, l := range route.Legs {
		s.cum[i] = cumulative(l.Path)
	}
	for _, it := range route.Timeline {
		s.end = max(s.end, it.T1Min)
	}
	return s
}

// End returns the last minute of the plan.
func (s *Sim) End() float64 { return s.end }

// Advance implements session.Engine. It emits "arrived" at the end of every walk crossed.
func (s *Sim) Advance(dtMin float64) []contract.Event {
	if dtMin <= 0 {
		return nil
	}
	s.started = true
	prev := s.t
	s.t = min(s.t+dtMin, s.end)
	var evs []contract.Event
	for _, it := range s.route.Timeline {
		if it.Kind == "walk" && it.T1Min > prev && it.T1Min <= s.t {
			evs = append(evs, contract.Event{Name: contract.EventArrived, TMin: it.T1Min})
		}
	}
	return evs
}

// Seek jumps to t (clamped to the plan) without emitting events.
func (s *Sim) Seek(t float64) {
	s.t = math.Max(0, math.Min(t, s.end))
	s.started = true
}

// Reset goes back to t = 0, before start.
func (s *Sim) Reset() {
	s.t = 0
	s.started = false
}

// Done implements session.Engine.
func (s *Sim) Done() bool { return s.t >= s.end }

// Snapshot implements session.Engine.
func (s *Sim) Snapshot() session.Snapshot {
	snap := session.Snapshot{TMin: s.t, Visited: s.visited()}
	tl := s.route.Timeline
	if !s.started {
		snap.Pos = s.route.Legs[0].Path[0]
		return snap
	}
	for i, it := range tl {
		if s.t >= it.T1Min {
			continue
		}
		if s.t < it.T0Min { // gap in the timeline: wait where the previous item ended
			snap.Pos = s.posBefore(i)
			return snap
		}
		if it.Kind == "dwell" {
			stop := *it.Stop
			snap.AtStop = &stop
			snap.Pos = s.posBefore(i)
			return snap
		}
		f := 0.0
		if it.T1Min > it.T0Min {
			f = (s.t - it.T0Min) / (it.T1Min - it.T0Min)
		}
		leg := *it.Leg
		snap.Leg = &leg
		snap.Pos = s.along(leg, f)
		return snap
	}
	snap.Pos = s.posBefore(len(tl)) // plan finished
	return snap
}

// visited lists stops whose full dwell has finished, in order.
func (s *Sim) visited() []string {
	out := []string{}
	for _, it := range s.route.Timeline {
		if it.Kind == "dwell" && s.t >= it.T1Min {
			out = append(out, *it.Stop)
		}
	}
	return out
}

// posBefore is where the astronaut stands when timeline item i begins: the end of the last walk
// before it, or the start of the route.
func (s *Sim) posBefore(i int) contract.XY {
	for j := i - 1; j >= 0; j-- {
		if it := s.route.Timeline[j]; it.Kind == "walk" {
			return s.legEnd(*it.Leg)
		}
	}
	return s.route.Legs[0].Path[0]
}

func (s *Sim) legEnd(leg int) contract.XY {
	p := s.route.Legs[leg].Path
	return p[len(p)-1]
}

// along returns the point at fraction f (0..1) of the leg's path length.
func (s *Sim) along(leg int, f float64) contract.XY {
	return PointAt(s.route.Legs[leg].Path, s.cum[leg], f)
}

// PointAt interpolates the point at fraction f of a path's length; cum is cumulative(path).
func PointAt(path []contract.XY, cum []float64, f float64) contract.XY {
	total := cum[len(cum)-1]
	if f <= 0 || total == 0 {
		return path[0]
	}
	if f >= 1 {
		return path[len(path)-1]
	}
	d := f * total
	for i := 1; i < len(path); i++ {
		if cum[i] >= d {
			seg := cum[i] - cum[i-1]
			u := 0.0
			if seg > 0 {
				u = (d - cum[i-1]) / seg
			}
			a, b := path[i-1], path[i]
			return contract.XY{a[0] + u*(b[0]-a[0]), a[1] + u*(b[1]-a[1])}
		}
	}
	return path[len(path)-1]
}

// cumulative returns the running length of a path, starting at 0.
func cumulative(path []contract.XY) []float64 {
	c := make([]float64, len(path))
	for i := 1; i < len(path); i++ {
		c[i] = c[i-1] + math.Hypot(path[i][0]-path[i-1][0], path[i][1]-path[i-1][1])
	}
	return c
}
