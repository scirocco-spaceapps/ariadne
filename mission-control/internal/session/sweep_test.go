package session

import (
	"testing"
	"time"

	"github.com/ozyusuf/ariadne/mission-control/internal/contract"
)

func TestSweep(t *testing.T) {
	st := NewStore()
	defer st.Close()
	idle := st.Create(&fakeEngine{}, false)
	listened := st.Create(&fakeEngine{}, false)
	running := st.Create(&fakeEngine{}, true)
	listened.Join(NewClient(contract.RoleCuff))

	if gone := st.Sweep(time.Now(), time.Hour); len(gone) != 0 {
		t.Fatalf("nothing is an hour old yet, swept %v", gone)
	}
	gone := st.Sweep(time.Now().Add(2*time.Hour), time.Hour)
	if len(gone) != 1 || gone[0] != idle.ID {
		t.Fatalf("swept %v, want only the idle session %s", gone, idle.ID)
	}
	if st.Get(idle.ID) != nil || st.Get(listened.ID) == nil || st.Get(running.ID) == nil {
		t.Fatal("only the idle session should be gone")
	}
	select {
	case <-idle.Done():
	default:
		t.Fatal("a swept session's Done channel must be closed")
	}
}

func TestJanitorRuns(t *testing.T) {
	st := NewStore()
	defer st.Close()
	s := st.Create(&fakeEngine{}, false)
	swept := make(chan []string, 1)
	st.StartJanitor(time.Millisecond, 5*time.Millisecond, func(ids []string) { swept <- ids })
	select {
	case ids := <-swept:
		if len(ids) != 1 || ids[0] != s.ID {
			t.Fatalf("swept %v", ids)
		}
	case <-time.After(2 * time.Second):
		t.Fatal("janitor did not sweep")
	}
}
