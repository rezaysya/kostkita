package service

import (
	"context"

	db "github.com/rezaysya/kostkita/backend/internal/database/sqlc"
	"github.com/rezaysya/kostkita/backend/internal/repository"
)

type KostService struct {
	repo *repository.KostRepository
}

func NewKostService(repo *repository.KostRepository) *KostService {
	return &KostService{
		repo: repo,
	}
}

func (s *KostService) ListPublished(
	ctx context.Context,
	limit int32,
	offset int32,
) ([]db.Kost, error) {
	return s.repo.ListPublished(ctx, limit, offset)
}
