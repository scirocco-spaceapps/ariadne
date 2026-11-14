package contract

// Source is the part every non-null condition carries (schema ConditionSource).
type Source struct {
	Provenance string `json:"provenance"`
	Source     string `json:"source"`
	SourceURL  string `json:"source_url,omitempty"`
	Mode       string `json:"mode"` // "archive" or "live"
	FetchedAt  string `json:"fetched_at,omitempty"`
}

// Weather is MEDA-style surface weather (schema Weather).
type Weather struct {
	Source
	Sol    *int                `json:"sol"`
	Values map[string]*float64 `json:"values"`
	Units  map[string]string   `json:"units"`
}

// Radiation is the surface dose rate (schema Radiation).
type Radiation struct {
	Source
	Value      float64 `json:"value"`
	Unit       string  `json:"unit"`
	MeasuredAt string  `json:"measured_at,omitempty"`
}

// SpaceWeatherEvent is one forecast arrival at Mars (schema SpaceWeatherEvent).
type SpaceWeatherEvent struct {
	ID             string `json:"id"`
	MarsArrivalUTC string `json:"mars_arrival_utc"`
	Source         string `json:"source"`
}

// SpaceWeather is the DONKI part (schema SpaceWeather). FetchedAt is required here.
type SpaceWeather struct {
	Source
	Events []SpaceWeatherEvent `json:"events"`
	Stale  bool                `json:"stale"`
}

// Partner is one partner-agency context value (schema Partner).
type Partner struct {
	Source
	Agency      string  `json:"agency"`
	Mission     string  `json:"mission"`
	Value       float64 `json:"value"`
	Unit        string  `json:"unit"`
	Description string  `json:"description,omitempty"`
}

// Missing holds the reason for every null part (schema Conditions.missing).
type Missing struct {
	Weather      string `json:"weather,omitempty"`
	Radiation    string `json:"radiation,omitempty"`
	SpaceWeather string `json:"space_weather,omitempty"`
	Partner      string `json:"partner,omitempty"`
}

// Conditions is the GET /conditions response.
type Conditions struct {
	Weather      *Weather      `json:"weather"`
	Radiation    *Radiation    `json:"radiation"`
	SpaceWeather *SpaceWeather `json:"space_weather"`
	Partner      *Partner      `json:"partner"`
	Missing      Missing       `json:"missing"`
}

// Condition modes and provenance values used by conditions.
const (
	ModeArchive = "archive"
	ModeLive    = "live"
)
