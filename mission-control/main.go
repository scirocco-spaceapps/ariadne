// Command mission-control runs the Ariadne EVA simulation service.
// Contract: contracts/openapi.yaml (tag mission-control) and contracts/ws-messages.md.
package main

import (
	"context"
	"log/slog"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/ozyusuf/ariadne/mission-control/internal/server"
)

func main() {
	slog.SetDefault(slog.New(slog.NewJSONHandler(os.Stdout, nil)))

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
	if v := os.Getenv("SESSION_TTL"); v != "" {
		d, err := time.ParseDuration(v)
		if err != nil {
			slog.Error("SESSION_TTL must be a duration like 2h", "value", v)
			os.Exit(2)
		}
		cfg.SessionTTL = d
	}
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	srv := server.New(cfg)
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	errc := make(chan error, 1)
	go func() { errc <- srv.App.Listen(":" + port) }()
	slog.Info("listening", "port", port, "planner", cfg.PlannerURL != "")

	select {
	case err := <-errc:
		slog.Error("server stopped", "err", err)
		os.Exit(1)
	case <-ctx.Done():
		slog.Info("shutting down")
		if err := srv.Shutdown(10 * time.Second); err != nil {
			slog.Error("shutdown", "err", err)
		}
	}
}
