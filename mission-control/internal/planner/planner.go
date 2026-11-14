// Package planner calls the planner service (contracts/openapi.yaml, tag planner).
package planner

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/ozyusuf/ariadne/mission-control/internal/contract"
)

// Timeout bounds one call; on timeout the caller falls back to another path.
const Timeout = 3 * time.Second

// ErrNotConfigured is returned when PLANNER_URL is empty.
var ErrNotConfigured = errors.New("PLANNER_URL is not set")

// Client calls POST /abort on the planner.
type Client struct {
	BaseURL string
	HTTP    *http.Client
}

// New returns a client for baseURL (no trailing slash needed).
func New(baseURL string) *Client {
	return &Client{BaseURL: strings.TrimRight(baseURL, "/"), HTTP: &http.Client{Timeout: Timeout}}
}

// abortResponse is schema AbortResponse.
type abortResponse struct {
	Path     []contract.XY `json:"path"`
	TimeMin  float64       `json:"time_min"`
	Distance float64       `json:"distance_m"`
}

// Abort returns the fastest path from `from` to the safe haven and its walking time in minutes.
func (c *Client) Abort(ctx context.Context, from contract.XY) ([]contract.XY, float64, error) {
	if c == nil || c.BaseURL == "" {
		return nil, 0, ErrNotConfigured
	}
	body, _ := json.Marshal(map[string]any{"from": from})
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.BaseURL+"/abort", bytes.NewReader(body))
	if err != nil {
		return nil, 0, err
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := c.HTTP.Do(req)
	if err != nil {
		return nil, 0, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, 0, fmt.Errorf("planner /abort: status %d", resp.StatusCode)
	}
	var out abortResponse
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		return nil, 0, fmt.Errorf("planner /abort: %w", err)
	}
	if len(out.Path) < 1 {
		return nil, 0, errors.New("planner /abort: empty path")
	}
	return out.Path, out.TimeMin, nil
}
