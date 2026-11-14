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
	if v := os.Getenv("REPLAY_PATH"); v != "" {
		cfg.ReplayPath = v
	}
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	log.Fatal(server.New(cfg).App.Listen(":" + port))
}
