package config

import (
	"fmt"
	"github.com/joho/godotenv"
	"os"
	"strconv"
)

type Config struct {
	AppEnv, AppPort                       string
	DBHost                                string
	DBPort                                uint16
	DBUser, DBPassword, DBName, DBSSLMode string
	JWTSecret                             string
	TokenHours                            int
}

func Load() (*Config, error) {
	_ = godotenv.Load()
	p, err := strconv.ParseUint(env("DB_PORT", "5432"), 10, 16)
	if err != nil {
		return nil, fmt.Errorf("invalid DB_PORT: %w", err)
	}
	h, err := strconv.Atoi(env("JWT_EXPIRE_HOURS", "24"))
	if err != nil || h < 1 {
		return nil, fmt.Errorf("JWT_EXPIRE_HOURS must be positive")
	}
	c := &Config{AppEnv: env("APP_ENV", "development"), AppPort: env("APP_PORT", "8080"), DBHost: env("DB_HOST", "localhost"), DBPort: uint16(p), DBUser: env("DB_USER", ""), DBPassword: env("DB_PASSWORD", ""), DBName: env("DB_NAME", ""), DBSSLMode: env("DB_SSLMODE", "disable"), JWTSecret: env("JWT_SECRET", ""), TokenHours: h}
	if c.DBUser == "" || c.DBName == "" || c.JWTSecret == "" {
		return nil, fmt.Errorf("DB_USER, DB_NAME, and JWT_SECRET must be configured")
	}
	if len(c.JWTSecret) < 32 {
		return nil, fmt.Errorf("JWT_SECRET must be at least 32 characters")
	}
	return c, nil
}
func env(k, d string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return d
}
