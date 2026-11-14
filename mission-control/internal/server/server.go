// Package server builds the mission-control HTTP app.
package server

import "github.com/gofiber/fiber/v2"

// Health is the /health response (schema Health in contracts/openapi.yaml).
type Health struct {
	Status  string `json:"status"`
	Service string `json:"service"`
}

// New returns the Fiber app with all routes registered.
func New() *fiber.App {
	app := fiber.New(fiber.Config{AppName: "ariadne-mission-control"})
	app.Get("/health", func(c *fiber.Ctx) error {
		return c.JSON(Health{Status: "ok", Service: "mission-control"})
	})
	return app
}
