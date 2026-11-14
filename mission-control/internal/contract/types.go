// Package contract holds the Go shapes of the mission-control messages in
// contracts/openapi.yaml and contracts/ws-messages.md. Field names and JSON tags must match them.
package contract

// XY is a local metric position [x east, y north] in metres from the AOI south-west corner.
type XY [2]float64

// Leg is one leg of a planned route (schema Leg).
type Leg struct {
	From        string  `json:"from"`
	To          string  `json:"to"`
	Path        []XY    `json:"path"`
	DistanceM   float64 `json:"distance_m"`
	TimeMin     float64 `json:"time_min"`
	ClimbM      float64 `json:"climb_m"`
	MaxSlopeDeg float64 `json:"max_slope_deg"`
}

// TimelineItem is a walk or dwell span of a planned route (schema TimelineItem).
type TimelineItem struct {
	Kind  string  `json:"kind"`
	Leg   *int    `json:"leg,omitempty"`
	Stop  *string `json:"stop,omitempty"`
	T0Min float64 `json:"t0_min"`
	T1Min float64 `json:"t1_min"`
}

// Totals sums a planned route (schema Totals).
type Totals struct {
	DistanceM float64 `json:"distance_m"`
	WalkMin   float64 `json:"walk_min"`
	DwellMin  float64 `json:"dwell_min"`
	EvaMin    float64 `json:"eva_min"`
}

// RouteResponse is the planner's route (schema RouteResponse).
type RouteResponse struct {
	Legs       []Leg          `json:"legs"`
	Timeline   []TimelineItem `json:"timeline"`
	Totals     Totals         `json:"totals"`
	Provenance string         `json:"provenance"`
}

// SessionCreate is the POST /sessions body.
type SessionCreate struct {
	Route      RouteResponse `json:"route"`
	BudgetMin  float64       `json:"budget_min"`
	ReserveMin float64       `json:"reserve_min"`
	DwellMin   float64       `json:"dwell_min"`
}

// SessionCreated is the POST /sessions response.
type SessionCreated struct {
	ID string `json:"id"`
}

// Error is the error body of every non-2xx response.
type Error struct {
	Detail string `json:"detail"`
}

// Ack is the body of accepted control, event and script calls.
type Ack struct {
	OK bool `json:"ok"`
}

// Alert is the active alert inside a state message (schema WsAlert).
type Alert struct {
	Type    string  `json:"type"`
	LeadMin float64 `json:"lead_min"`
	SinceT  float64 `json:"since_t"`
}

// State is the WebSocket state message (schema WsState). Nil pointers and slices encode as null,
// except Visited, which must always be a list.
type State struct {
	Type       string   `json:"type"`
	Session    string   `json:"session"`
	TMin       float64  `json:"t_min"`
	Running    bool     `json:"running"`
	Speed      float64  `json:"speed"`
	Pos        XY       `json:"pos"`
	Leg        *int     `json:"leg"`
	AtStop     *string  `json:"at_stop"`
	Visited    []string `json:"visited"`
	Alert      *Alert   `json:"alert"`
	AbortPath  []XY     `json:"abort_path"`
	Provenance string   `json:"provenance"`
}

// Event is the WebSocket event message (schema WsEvent).
type Event struct {
	Type string  `json:"type"`
	Name string  `json:"name"`
	TMin float64 `json:"t_min"`
}

// Hello is the only client-to-server message (schema WsHello).
type Hello struct {
	Type string `json:"type"`
	Role string `json:"role"`
}

// Event names and roles from the contract.
const (
	EventStormAlert = "storm_alert"
	EventClear      = "clear"
	EventArrived    = "arrived"

	RoleConsole = "console"
	RoleCuff    = "cuff"
)
