package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/rezaysya/kostkita/backend/internal/api"
	"github.com/rezaysya/kostkita/backend/internal/config"
	"github.com/rezaysya/kostkita/backend/internal/database"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatal("configuration error: ", err)
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	pool, err := database.NewPostgresPool(ctx, cfg)
	if err != nil {
		log.Fatal("database connection failed: ", err)
	}
	defer pool.Close()
	app := &api.API{DB: pool, Secret: []byte(cfg.JWTSecret), TokenHours: cfg.TokenHours}
	srv := &http.Server{Addr: ":" + cfg.AppPort, Handler: app.Router(), ReadHeaderTimeout: 5 * time.Second, ReadTimeout: 15 * time.Second, WriteTimeout: 30 * time.Second, IdleTimeout: 60 * time.Second}
	go func() {
		log.Printf("KostKita API listening on http://localhost%s", srv.Addr)
		if e := srv.ListenAndServe(); e != nil && e != http.ErrServerClosed {
			log.Fatal(e)
		}
	}()
	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
	<-stop
	shutdown, c := context.WithTimeout(context.Background(), 10*time.Second)
	defer c()
	if e := srv.Shutdown(shutdown); e != nil {
		log.Fatal("server shutdown: ", e)
	}
}
