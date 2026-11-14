package server

import (
	"sync"
	"time"
)

// windowLimiter allows at most max calls per key in each fixed window.
type windowLimiter struct {
	max    int
	window time.Duration

	mu     sync.Mutex
	counts map[string]windowCount
}

type windowCount struct {
	start time.Time
	n     int
}

func newWindowLimiter(max int, window time.Duration) *windowLimiter {
	return &windowLimiter{max: max, window: window, counts: make(map[string]windowCount)}
}

// allow records one call for key at now and reports whether it is within the limit.
func (l *windowLimiter) allow(key string, now time.Time) bool {
	l.mu.Lock()
	defer l.mu.Unlock()
	c := l.counts[key]
	if now.Sub(c.start) >= l.window {
		// New window; also drop keys whose window ended, so the map does not grow without bound.
		for k, v := range l.counts {
			if now.Sub(v.start) >= l.window {
				delete(l.counts, k)
			}
		}
		c = windowCount{start: now}
	}
	c.n++
	l.counts[key] = c
	return c.n <= l.max
}
