package session

import (
	"bufio"
	"encoding/json"
	"fmt"
	"io"

	"github.com/ozyusuf/ariadne/mission-control/internal/contract"
)

// Replay is an Engine that plays back recorded state messages (contracts/fixtures/ws-state.jsonl).
// The snapshot at time t is the last recorded state with t_min <= t.
type Replay struct {
	states []contract.State
	t      float64
}

// LoadReplay reads one state message per line.
func LoadReplay(r io.Reader) (*Replay, error) {
	var states []contract.State
	sc := bufio.NewScanner(r)
	sc.Buffer(make([]byte, 64*1024), 1024*1024)
	for n := 1; sc.Scan(); n++ {
		line := sc.Bytes()
		if len(line) == 0 {
			continue
		}
		var s contract.State
		if err := json.Unmarshal(line, &s); err != nil {
			return nil, fmt.Errorf("line %d: %w", n, err)
		}
		if s.Type != "state" {
			continue
		}
		states = append(states, s)
	}
	if err := sc.Err(); err != nil {
		return nil, err
	}
	if len(states) == 0 {
		return nil, fmt.Errorf("no state messages")
	}
	return &Replay{states: states, t: states[0].TMin}, nil
}

// Advance implements Engine.
func (r *Replay) Advance(dtMin float64) []contract.Event {
	last := r.states[len(r.states)-1].TMin
	r.t = min(r.t+dtMin, last)
	return nil
}

// Snapshot implements Engine.
func (r *Replay) Snapshot() Snapshot {
	cur := r.states[0]
	for _, s := range r.states {
		if s.TMin > r.t {
			break
		}
		cur = s
	}
	return Snapshot{
		TMin:      r.t,
		Pos:       cur.Pos,
		Leg:       cur.Leg,
		AtStop:    cur.AtStop,
		Visited:   cur.Visited,
		Alert:     cur.Alert,
		AbortPath: cur.AbortPath,
	}
}

// Done implements Engine.
func (r *Replay) Done() bool {
	return r.t >= r.states[len(r.states)-1].TMin
}
