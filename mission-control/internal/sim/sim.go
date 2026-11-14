// Package sim walks a simulated astronaut along a planned route. Everything it produces is
// Simulation. Without alerts the run is a pure function of simulated time, so it is deterministic
// for a plan; an alert detours the astronaut along an abort path, and clearing it walks back to
// where the plan was left.
package sim

import (
	"errors"
	"math"

	"github.com/ozyusuf/ariadne/mission-control/internal/contract"
	"github.com/ozyusuf/ariadne/mission-control/internal/session"
)

type mode int

const (
	modePlan   mode = iota // following the route timeline
	modeAbort              // walking abort_path to the safe haven
	modeReturn             // alert cleared: walking back to the point where the plan was left
	modeHome               // reached the safe haven on an abort path
)

// Errors returned by StartAlert and Clear.
var (
	ErrAlertActive = errors.New("an alert is already active")
	ErrAtHome      = errors.New("already at the safe haven")
	ErrNoAlert     = errors.New("no active alert")
)

// Sim implements session.Engine for one planned route.
type Sim struct {
	route     contract.RouteResponse
	cum       [][]float64 // cumulative length along each leg path, metres
	end       float64     // end of the timeline, minutes
	walkSpeed float64     // mean planned walking speed, m/min; used when no abort time is known

	t       float64 // session time, minutes since EVA start
	planT   float64 // position on the route timeline
	started bool
	mode    mode

	alert     *contract.Alert
	abortPath []contract.XY // shown to clients; walked in modeAbort
	walk      track         // the detour being walked in modeAbort or modeReturn
	pending   []contract.XY // from the abort start back to the plan (set when an alert hits a return)
	resumeT   float64       // plan time to resume at after a detour
}

// track is a polyline walked at a fixed speed.
type track struct {
	path  []contract.XY
	cum   []float64
	d     float64 // metres walked
	speed float64 // m/min
}

func newTrack(path []contract.XY, speed float64) track {
	return track{path: path, cum: cumulative(path), speed: speed}
}

func (w *track) length() float64  { return w.cum[len(w.cum)-1] }
func (w *track) pos() contract.XY { return pointAtDist(w.path, w.cum, w.d) }
func (w *track) done() bool       { return w.d >= w.length() }

// step walks for up to dt minutes and returns the minutes used.
func (w *track) step(dt float64) float64 {
	left := w.length() - w.d
	if left <= 0 {
		return 0
	}
	if w.speed <= 0 || math.IsInf(w.speed, 1) {
		w.d = w.length()
		return 0
	}
	used := math.Min(dt, left/w.speed)
	w.d = math.Min(w.length(), w.d+used*w.speed)
	if w.length()-w.d < 1e-9 {
		w.d = w.length()
	}
	return used
}

// walked returns the part of the path already behind, ending at the current position.
func (w *track) walked() []contract.XY {
	out := []contract.XY{}
	for i, p := range w.path {
		if w.cum[i] >= w.d {
			break
		}
		out = append(out, p)
	}
	return appendPoint(out, w.pos())
}

// ahead returns the part of the path still to walk, starting at the current position.
func (w *track) ahead() []contract.XY {
	out := []contract.XY{w.pos()}
	for i, p := range w.path {
		if w.cum[i] > w.d {
			out = appendPoint(out, p)
		}
	}
	return out
}

// New returns a simulator at t = 0, before start. The route must be validated first.
func New(route contract.RouteResponse) *Sim {
	s := &Sim{route: route, cum: make([][]float64, len(route.Legs))}
	for i, l := range route.Legs {
		s.cum[i] = cumulative(l.Path)
	}
	var dist, walkMin float64
	for _, it := range route.Timeline {
		s.end = max(s.end, it.T1Min)
		if it.Kind == "walk" {
			c := s.cum[*it.Leg]
			dist += c[len(c)-1]
			walkMin += it.T1Min - it.T0Min
		}
	}
	if walkMin > 0 {
		s.walkSpeed = dist / walkMin
	} else {
		s.walkSpeed = math.Inf(1)
	}
	return s
}

// Route returns the planned route. It never changes after New.
func (s *Sim) Route() contract.RouteResponse { return s.route }

// End returns the last minute of the plan.
func (s *Sim) End() float64 { return s.end }

// Haven is where the route starts: the safe haven.
func (s *Sim) Haven() contract.XY { return s.route.Legs[0].Path[0] }

// Advance implements session.Engine. It emits "arrived" at the end of every planned walk crossed
// and on reaching the safe haven during an abort.
func (s *Sim) Advance(dtMin float64) []contract.Event {
	if dtMin <= 0 {
		return nil
	}
	s.started = true
	var evs []contract.Event
	for dtMin > 1e-12 && !s.Done() {
		switch s.mode {
		case modePlan:
			used := math.Min(dtMin, s.end-s.planT)
			prev := s.planT
			s.planT += used
			s.t += used
			dtMin -= used
			for _, it := range s.route.Timeline {
				if it.Kind == "walk" && it.T1Min > prev && it.T1Min <= s.planT {
					evs = append(evs, contract.Event{Name: contract.EventArrived, TMin: s.t - (s.planT - it.T1Min)})
				}
			}
		case modeAbort:
			used := s.walk.step(dtMin)
			s.t += used
			dtMin -= used
			if s.walk.done() {
				s.mode = modeHome
				evs = append(evs, contract.Event{Name: contract.EventArrived, TMin: s.t})
			}
		case modeReturn:
			used := s.walk.step(dtMin)
			s.t += used
			dtMin -= used
			if s.walk.done() {
				s.mode = modePlan
				s.planT = s.resumeT
			}
		}
	}
	return evs
}

// Seek jumps to plan time t (clamped to the plan) without emitting events. It drops any alert:
// seeking is for planning, not for live runs.
func (s *Sim) Seek(t float64) {
	t = math.Max(0, math.Min(t, s.end))
	s.dropDetour()
	s.t, s.planT = t, t
	s.started = true
}

// Reset goes back to t = 0, before start.
func (s *Sim) Reset() {
	s.dropDetour()
	s.t, s.planT = 0, 0
	s.started = false
}

func (s *Sim) dropDetour() {
	s.mode = modePlan
	s.alert, s.abortPath, s.pending = nil, nil, nil
	s.walk = track{}
}

// Done implements session.Engine.
func (s *Sim) Done() bool {
	return s.mode == modeHome || (s.mode == modePlan && s.planT >= s.end)
}

// Position returns the current simulated position.
func (s *Sim) Position() contract.XY { return s.Snapshot().Pos }

// StartAlert raises a storm alert and walks path to the safe haven. timeMin is the planner's
// walking time for path; 0 means unknown (the planned mean speed is used). An empty path retraces
// the way already walked.
func (s *Sim) StartAlert(leadMin float64, path []contract.XY, timeMin float64) error {
	switch s.mode {
	case modeAbort:
		return ErrAlertActive
	case modeHome:
		return ErrAtHome
	}
	pos := s.Position()
	if s.mode == modePlan {
		s.resumeT = s.planT
		if it, ok := s.itemAt(s.planT); ok && it.Kind == "dwell" {
			s.resumeT = it.T0Min // a dwell cut short is redone, so it is not visited
		}
		s.pending = nil
	} else { // modeReturn: remember the rest of the way back to the plan
		s.pending = s.walk.ahead()
	}
	if len(path) == 0 {
		path = s.retrace(pos)
	}
	full := appendPoint([]contract.XY{pos}, path...)
	if len(full) < 2 {
		full = append(full, pos) // already at the haven: a zero-length walk
	}
	speed := s.walkSpeed
	if timeMin > 0 {
		speed = cumulative(full)[len(full)-1] / timeMin
	}
	s.mode = modeAbort
	s.started = true
	s.alert = &contract.Alert{Type: contract.EventStormAlert, LeadMin: leadMin, SinceT: s.t}
	s.abortPath = full
	s.walk = newTrack(full, speed)
	return nil
}

// Clear drops the alert. Away from the safe haven, the astronaut walks back along the abort path
// to where the plan was left and the plan resumes.
func (s *Sim) Clear() error {
	if s.alert == nil {
		return ErrNoAlert
	}
	s.alert, s.abortPath = nil, nil
	if s.mode == modeHome {
		return nil
	}
	back := appendPoint(reversed(s.walk.walked()), s.pending...)
	s.pending = nil
	s.mode = modeReturn
	s.walk = newTrack(back, s.walk.speed)
	if len(back) < 2 || s.walk.length() == 0 {
		s.mode = modePlan
		s.planT = s.resumeT
	}
	return nil
}

// retrace is the way back home over ground already walked: from pos, through the pending return
// path, then the planned route backwards from the resume point.
func (s *Sim) retrace(pos contract.XY) []contract.XY {
	out := appendPoint([]contract.XY{pos}, s.pending...)
	var fwd []contract.XY
	for _, it := range s.route.Timeline {
		if it.Kind != "walk" || it.T0Min >= s.resumeT {
			continue
		}
		leg := *it.Leg
		if s.resumeT >= it.T1Min {
			fwd = appendPoint(fwd, s.route.Legs[leg].Path...)
			continue
		}
		f := (s.resumeT - it.T0Min) / (it.T1Min - it.T0Min)
		d := f * s.cum[leg][len(s.cum[leg])-1]
		for i, p := range s.route.Legs[leg].Path {
			if s.cum[leg][i] < d {
				fwd = appendPoint(fwd, p)
			}
		}
		fwd = appendPoint(fwd, s.along(leg, f))
	}
	out = appendPoint(out, reversed(fwd)...)
	return appendPoint(out, s.Haven())
}

// Snapshot implements session.Engine.
func (s *Sim) Snapshot() session.Snapshot {
	snap := session.Snapshot{TMin: s.t, Visited: s.visited(), Alert: s.alert, AbortPath: s.abortPath}
	switch s.mode {
	case modeAbort, modeHome:
		snap.Pos = s.walk.pos()
		return snap
	case modeReturn:
		snap.Pos = s.walk.pos()
		snap.Leg = s.legToward(s.resumeT)
		return snap
	}
	if !s.started {
		snap.Pos = s.Haven()
		return snap
	}
	tl := s.route.Timeline
	for i, it := range tl {
		if s.planT >= it.T1Min {
			continue
		}
		if s.planT < it.T0Min { // gap in the timeline: wait where the previous item ended
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
			f = (s.planT - it.T0Min) / (it.T1Min - it.T0Min)
		}
		leg := *it.Leg
		snap.Leg = &leg
		snap.Pos = s.along(leg, f)
		return snap
	}
	snap.Pos = s.posBefore(len(tl)) // plan finished
	return snap
}

// itemAt returns the timeline item active at plan time t.
func (s *Sim) itemAt(t float64) (contract.TimelineItem, bool) {
	for _, it := range s.route.Timeline {
		if t >= it.T0Min && t < it.T1Min {
			return it, true
		}
	}
	return contract.TimelineItem{}, false
}

// legToward is the leg that leads to the stop the plan resumes toward: the walk active at t, or
// the last walk before it.
func (s *Sim) legToward(t float64) *int {
	var out *int
	for _, it := range s.route.Timeline {
		if it.T0Min > t {
			break
		}
		if it.Kind == "walk" {
			leg := *it.Leg
			out = &leg
		}
	}
	return out
}

// visited lists stops whose full dwell has finished, in order.
func (s *Sim) visited() []string {
	out := []string{}
	for _, it := range s.route.Timeline {
		if it.Kind == "dwell" && s.planT >= it.T1Min {
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
			p := s.route.Legs[*it.Leg].Path
			return p[len(p)-1]
		}
	}
	return s.Haven()
}

// along returns the point at fraction f (0..1) of the leg's path length.
func (s *Sim) along(leg int, f float64) contract.XY {
	c := s.cum[leg]
	return pointAtDist(s.route.Legs[leg].Path, c, math.Max(0, math.Min(1, f))*c[len(c)-1])
}

// pointAtDist interpolates the point d metres along a path; cum is cumulative(path).
func pointAtDist(path []contract.XY, cum []float64, d float64) contract.XY {
	if d <= 0 {
		return path[0]
	}
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

// appendPoint appends points, skipping any that repeat the previous one.
func appendPoint(path []contract.XY, pts ...contract.XY) []contract.XY {
	for _, p := range pts {
		if n := len(path); n > 0 && math.Hypot(p[0]-path[n-1][0], p[1]-path[n-1][1]) < 1e-6 {
			continue
		}
		path = append(path, p)
	}
	return path
}

func reversed(path []contract.XY) []contract.XY {
	out := make([]contract.XY, len(path))
	for i, p := range path {
		out[len(path)-1-i] = p
	}
	return out
}
