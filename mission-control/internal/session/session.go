// Package session holds EVA sessions: the simulation engine of each session, its clock and the
// WebSocket clients that listen to it. Every listener of a session receives identical frames.
package session

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"sync"
	"time"

	"github.com/ozyusuf/ariadne/mission-control/internal/contract"
)

// TickInterval is the wall-clock period of state broadcasts while running (2 Hz, ws-messages.md).
const TickInterval = 500 * time.Millisecond

// DefaultSpeed is simulated minutes per real second when a session is created.
const DefaultSpeed = 6.0

// Snapshot is the simulated part of a state message.
type Snapshot struct {
	TMin      float64
	Pos       contract.XY
	Leg       *int
	AtStop    *string
	Visited   []string
	Alert     *contract.Alert
	AbortPath []contract.XY
}

// Engine advances the simulated astronaut. It is only called with the session lock held.
type Engine interface {
	// Advance moves simulated time forward by dtMin minutes and returns the events that happened.
	Advance(dtMin float64) []contract.Event
	// Snapshot describes the current simulated state.
	Snapshot() Snapshot
	// Done reports that nothing more will happen without outside input; the clock stops.
	Done() bool
}

// Client is one WebSocket listener. Frames are queued on Send; a writer goroutine drains it.
type Client struct {
	Role string
	Send chan []byte
}

// NewClient returns a client with a small send buffer.
func NewClient(role string) *Client {
	return &Client{Role: role, Send: make(chan []byte, 32)}
}

// Session is one EVA run shared by a console and any number of cuffs.
type Session struct {
	ID string

	mu      sync.Mutex
	engine  Engine
	running bool
	speed   float64
	clients map[*Client]struct{}
	stop    chan struct{}
	active  time.Time // last join, leave, update or running tick
}

func newSession(id string, engine Engine) *Session {
	return &Session{
		ID:      id,
		engine:  engine,
		speed:   DefaultSpeed,
		clients: make(map[*Client]struct{}),
		stop:    make(chan struct{}),
		active:  time.Now(),
	}
}

// Join registers a client and queues the current state for it alone.
func (s *Session) Join(c *Client) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.clients[c] = struct{}{}
	s.active = time.Now()
	enqueue(c, s.stateFrameLocked())
}

// Leave unregisters a client. Leaving twice is harmless.
func (s *Session) Leave(c *Client) {
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.clients, c)
	s.active = time.Now()
}

// Clients returns the number of connected listeners.
func (s *Session) Clients() int {
	s.mu.Lock()
	defer s.mu.Unlock()
	return len(s.clients)
}

// State returns the current state message.
func (s *Session) State() contract.State {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.stateLocked()
}

// Update runs fn with the lock held, then broadcasts any events it returns followed by one state,
// as ws-messages.md requires after every control, event or script call.
func (s *Session) Update(fn func(*Control) []contract.Event) {
	s.mu.Lock()
	defer s.mu.Unlock()
	evs := fn(&Control{s: s})
	s.active = time.Now()
	s.broadcastLocked(evs)
}

// Control is the view of a session that Update callbacks may change.
type Control struct{ s *Session }

// Engine returns the session's engine.
func (c *Control) Engine() Engine { return c.s.engine }

// SetEngine replaces the engine, e.g. on reset.
func (c *Control) SetEngine(e Engine) { c.s.engine = e }

// SetRunning starts or stops the clock.
func (c *Control) SetRunning(r bool) { c.s.running = r }

// SetSpeed sets simulated minutes per real second.
func (c *Control) SetSpeed(v float64) { c.s.speed = v }

// tick advances the clock by real elapsed time and broadcasts while running.
func (s *Session) tick(elapsed time.Duration) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if !s.running {
		return
	}
	s.active = time.Now()
	evs := s.engine.Advance(elapsed.Seconds() * s.speed)
	if s.engine.Done() {
		s.running = false
	}
	s.broadcastLocked(evs)
}

func (s *Session) run() {
	t := time.NewTicker(TickInterval)
	defer t.Stop()
	last := time.Now()
	for {
		select {
		case <-s.stop:
			return
		case now := <-t.C:
			s.tick(now.Sub(last))
			last = now
		}
	}
}

func (s *Session) broadcastLocked(evs []contract.Event) {
	frames := make([][]byte, 0, len(evs)+1)
	for _, e := range evs {
		e.Type = "event"
		b, _ := json.Marshal(e)
		frames = append(frames, b)
	}
	frames = append(frames, s.stateFrameLocked())
	for c := range s.clients {
		for _, f := range frames {
			if !enqueue(c, f) {
				// A client that cannot keep up is dropped; it reconnects and gets the truth.
				delete(s.clients, c)
				close(c.Send)
				break
			}
		}
	}
}

func (s *Session) stateLocked() contract.State {
	snap := s.engine.Snapshot()
	visited := snap.Visited
	if visited == nil {
		visited = []string{}
	}
	return contract.State{
		Type:       "state",
		Session:    s.ID,
		TMin:       snap.TMin,
		Running:    s.running,
		Speed:      s.speed,
		Pos:        snap.Pos,
		Leg:        snap.Leg,
		AtStop:     snap.AtStop,
		Visited:    visited,
		Alert:      snap.Alert,
		AbortPath:  snap.AbortPath,
		Provenance: "Simulation",
	}
}

func (s *Session) stateFrameLocked() []byte {
	b, _ := json.Marshal(s.stateLocked())
	return b
}

func enqueue(c *Client, frame []byte) bool {
	select {
	case c.Send <- frame:
		return true
	default:
		return false
	}
}

// Done is closed when the session is removed from its store.
func (s *Session) Done() <-chan struct{} { return s.stop }

// idleSince reports whether nobody listens, the clock is stopped, and nothing happened since t.
func (s *Session) idleSince(t time.Time) bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	return len(s.clients) == 0 && !s.running && s.active.Before(t)
}

// Store holds all sessions in memory.
type Store struct {
	mu       sync.Mutex
	sessions map[string]*Session
	janitor  chan struct{}
}

// NewStore returns an empty store.
func NewStore() *Store {
	return &Store{sessions: make(map[string]*Session)}
}

// Create starts a new session around engine. The clock starts according to running.
func (st *Store) Create(engine Engine, running bool) *Session {
	s := newSession(newID(), engine)
	s.running = running
	st.mu.Lock()
	st.sessions[s.ID] = s
	st.mu.Unlock()
	go s.run()
	return s
}

// Get returns the session with id, or nil.
func (st *Store) Get(id string) *Session {
	st.mu.Lock()
	defer st.mu.Unlock()
	return st.sessions[id]
}

// Len returns the number of sessions.
func (st *Store) Len() int {
	st.mu.Lock()
	defer st.mu.Unlock()
	return len(st.sessions)
}

// Sweep removes sessions that have been idle (no listeners, clock stopped) for longer than ttl
// and returns their ids.
func (st *Store) Sweep(now time.Time, ttl time.Duration) []string {
	st.mu.Lock()
	defer st.mu.Unlock()
	var gone []string
	for id, s := range st.sessions {
		if s.idleSince(now.Add(-ttl)) {
			close(s.stop)
			delete(st.sessions, id)
			gone = append(gone, id)
		}
	}
	return gone
}

// StartJanitor sweeps every interval until Close; onSweep sees the removed ids.
func (st *Store) StartJanitor(ttl, interval time.Duration, onSweep func(ids []string)) {
	st.mu.Lock()
	if st.janitor != nil {
		st.mu.Unlock()
		return
	}
	st.janitor = make(chan struct{})
	done := st.janitor
	st.mu.Unlock()
	go func() {
		t := time.NewTicker(interval)
		defer t.Stop()
		for {
			select {
			case <-done:
				return
			case now := <-t.C:
				if ids := st.Sweep(now, ttl); len(ids) > 0 && onSweep != nil {
					onSweep(ids)
				}
			}
		}
	}()
}

// Close stops the janitor and every session clock.
func (st *Store) Close() {
	st.mu.Lock()
	defer st.mu.Unlock()
	if st.janitor != nil {
		close(st.janitor)
		st.janitor = nil
	}
	for id, s := range st.sessions {
		close(s.stop)
		delete(st.sessions, id)
	}
}

func newID() string {
	b := make([]byte, 8)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}
