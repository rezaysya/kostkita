package database

import (
	"context"
	"fmt"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/rezaysya/kostkita/backend/internal/config"
	"net"
	"net/url"
	"strconv"
)

func NewPostgresPool(ctx context.Context, c *config.Config) (*pgxpool.Pool, error) {
	u := url.URL{Scheme: "postgres", User: url.UserPassword(c.DBUser, c.DBPassword), Host: net.JoinHostPort(c.DBHost, strconv.Itoa(int(c.DBPort))), Path: c.DBName}
	q := url.Values{}
	q.Set("sslmode", c.DBSSLMode)
	u.RawQuery = q.Encode()
	pc, err := pgxpool.ParseConfig(u.String())
	if err != nil {
		return nil, fmt.Errorf("parse database config: %w", err)
	}
	pc.MaxConns = 10
	pc.MinConns = 1
	p, err := pgxpool.NewWithConfig(ctx, pc)
	if err != nil {
		return nil, err
	}
	if err = p.Ping(ctx); err != nil {
		p.Close()
		return nil, fmt.Errorf("connect PostgreSQL: %w", err)
	}
	return p, nil
}
