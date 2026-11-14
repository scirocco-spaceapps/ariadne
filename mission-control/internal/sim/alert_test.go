package sim

import (
	"math"
	"reflect"
	"testing"

	"github.com/ozyusuf/ariadne/mission-control/internal/contract"
)

func near(a, b contract.XY) bool { return math.Hypot(a[0]-b[0], a[1]-b[1]) < 1e-6 }

func TestAlertAbortToArrival(t *testing.T) {
	s := New(toyRoute())
	s.Seek(5) // on leg 0 at (50, 0)
	if err := s.StartAlert(30, []contract.XY{{0, 0}}, 5); err != nil {
		t.Fatal(err)
	}
	snap := s.Snapshot()
	if snap.Alert == nil || snap.Alert.LeadMin != 30 || snap.Alert.SinceT != 5 {
		t.Fatalf("alert = %+v", snap.Alert)
	}
	if snap.Leg != nil || snap.AtStop != nil || len(snap.AbortPath) != 2 || !near(snap.AbortPath[0], contract.XY{50, 0}) {
		t.Fatalf("abort snapshot = %+v", snap)
	}
	if err := s.StartAlert(10, nil, 0); err != ErrAlertActive {
		t.Fatalf("second alert err = %v", err)
	}
	s.Advance(2.5) // planner says 50 m in 5 min
	if p := s.Snapshot().Pos; !near(p, contract.XY{25, 0}) {
		t.Fatalf("pos after 2.5 min = %v", p)
	}
	evs := s.Advance(100)
	if len(evs) != 1 || evs[0].Name != "arrived" || evs[0].TMin != 10 {
		t.Fatalf("events = %v, want arrived at 10", evs)
	}
	snap = s.Snapshot()
	if !s.Done() || !near(snap.Pos, contract.XY{0, 0}) || snap.TMin != 10 || snap.Alert.LeadMin != 30 {
		t.Fatalf("home snapshot = %+v", snap)
	}
	if err := s.Clear(); err != nil || s.Snapshot().Alert != nil || !s.Done() {
		t.Fatalf("clear at home: err %v, snapshot %+v", err, s.Snapshot())
	}
	if err := s.Clear(); err != ErrNoAlert {
		t.Fatalf("clear without alert err = %v", err)
	}
	if err := s.StartAlert(10, nil, 0); err != ErrAtHome {
		t.Fatalf("alert at home err = %v", err)
	}
}

func TestAlertInDwellThenClearRedoesTheDwell(t *testing.T) {
	s := New(toyRoute())                             // mean speed 150 m / 20 min = 7.5 m/min
	s.Seek(12)                                       // dwelling at s1
	if err := s.StartAlert(60, nil, 0); err != nil { // no path: retrace to the haven
		t.Fatal(err)
	}
	if ap := s.Snapshot().AbortPath; len(ap) != 2 || !near(ap[0], contract.XY{100, 0}) || !near(ap[1], contract.XY{0, 0}) {
		t.Fatalf("retrace path = %v", ap)
	}
	s.Advance(4)
	if p := s.Snapshot().Pos; !near(p, contract.XY{70, 0}) {
		t.Fatalf("pos = %v, want 70,0", p)
	}
	if err := s.Clear(); err != nil {
		t.Fatal(err)
	}
	snap := s.Snapshot()
	if snap.Alert != nil || snap.AbortPath != nil || snap.Leg == nil || *snap.Leg != 0 || len(snap.Visited) != 0 {
		t.Fatalf("returning snapshot = %+v", snap)
	}
	s.Advance(4) // 30 m back to s1
	snap = s.Snapshot()
	if snap.AtStop == nil || *snap.AtStop != "s1" || snap.TMin != 20 {
		t.Fatalf("after return: %+v", snap)
	}
	s.Advance(5) // the full dwell, again
	if v := s.Snapshot().Visited; !reflect.DeepEqual(v, []string{"s1"}) {
		t.Fatalf("visited = %v", v)
	}
}

func TestAlertDuringReturn(t *testing.T) {
	s := New(toyRoute())
	s.Seek(20) // leg 1 at (100, 25)
	_ = s.StartAlert(60, []contract.XY{{100, 0}, {0, 0}}, 0)
	s.Advance(2) // 15 m toward (100, 0): at (100, 10)
	_ = s.Clear()
	s.Advance(1) // back up 7.5 m: at (100, 17.5)
	if err := s.StartAlert(60, nil, 0); err != nil {
		t.Fatal(err)
	}
	ap := s.Snapshot().AbortPath
	if !near(ap[0], contract.XY{100, 17.5}) || !near(ap[len(ap)-1], contract.XY{0, 0}) {
		t.Fatalf("second abort path = %v", ap)
	}
	s.Advance(1)
	_ = s.Clear()
	s.Advance(100)
	snap := s.Snapshot()
	if !s.Done() || !reflect.DeepEqual(snap.Visited, []string{"s1", "s2"}) || !near(snap.Pos, contract.XY{100, 50}) {
		t.Fatalf("plan should finish after two detours: %+v", snap)
	}
}
