// Command mission-control runs the Ariadne EVA simulation service.
// Contract: contracts/openapi.yaml (tag mission-control) and contracts/ws-messages.md.
package main

import (
	"log"
	"os"

	"github.com/ozyusuf/ariadne/mission-control/internal/server"
)

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8002"
	}
	log.Fatal(server.New().Listen(":" + port))
}
