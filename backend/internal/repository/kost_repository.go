package repository

import (
	"context"

	db "github.com/rezaysya/kostkita/backend/internal/database/sqlc"
)

type KostRepository struct {
	queries *db.Queries
}

func NewKostRepository(queries *db.Queries) *KostRepository {
	return &KostRepository{
		queries: queries,
	}
}

func (r *KostRepository) ListPublished(
	ctx context.Context,
	limit int32,
	offset int32,
) ([]db.Kost, error) {
	return r.queries.ListPublishedKosts(ctx, db.ListPublishedKostsParams{
		Limit:  limit,
		Offset: offset,
	})
}
