// Command mission-control runs the Ariadne EVA simulation service.
// Contract: contracts/openapi.yaml (tag mission-control) and contracts/ws-messages.md.
package main

import (
	"log"
	"os"

	"github.com/ozyusuf/ariadne/mission-control/internal/server"
)

func main() {
	cfg := server.DefaultConfig()
	if v := os.Getenv("WEB_ORIGIN"); v != "" {
		cfg.WebOrigins = v
	}
	cfg.PlannerURL = os.Getenv("PLANNER_URL")
	cfg.NASAAPIKey = os.Getenv("NASA_API_KEY")
	if v := os.Getenv("MODEL_PARAMS_PATH"); v != "" {
		cfg.ParamsPath = v
	}
	if v := os.Getenv("MEDA_PATH"); v != "" {
		cfg.MEDAPath = v
	}
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	log.Fatal(server.New(cfg).App.Listen(":" + port))
}
