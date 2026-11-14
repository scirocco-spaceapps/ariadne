package planner

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/ozyusuf/ariadne/mission-control/internal/contract"
)

func TestAbort(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var req struct{ From contract.XY }
		if r.URL.Path != "/abort" || json.NewDecoder(r.Body).Decode(&req) != nil || req.From != (contract.XY{5, 6}) {
			w.WriteHeader(http.StatusUnprocessableEntity)
			return
		}
		_, _ = w.Write([]byte(`{"path":[[5,6],[0,0]],"time_min":3,"distance_m":7.8,"provenance":"Modeled"}`))
	}))
	defer srv.Close()

	path, tm, err := New(srv.URL+"/").Abort(context.Background(), contract.XY{5, 6})
	if err != nil || tm != 3 || len(path) != 2 || path[1] != (contract.XY{0, 0}) {
		t.Fatalf("path %v time %v err %v", path, tm, err)
	}
	if _, _, err := New(srv.URL).Abort(context.Background(), contract.XY{1, 1}); err == nil {
		t.Fatal("a 422 should be an error")
	}
	if _, _, err := New("").Abort(context.Background(), contract.XY{}); err != ErrNotConfigured {
		t.Fatalf("empty URL err = %v", err)
	}
}
