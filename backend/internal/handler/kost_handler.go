package handler

import (
	"encoding/json"
	"net/http"
	"strconv"

	db "github.com/rezaysya/kostkita/backend/internal/database/sqlc"
	"github.com/rezaysya/kostkita/backend/internal/service"
)

type KostHandler struct {
	service *service.KostService
}

func NewKostHandler(service *service.KostService) *KostHandler {
	return &KostHandler{
		service: service,
	}
}

func (h *KostHandler) ListPublished(w http.ResponseWriter, r *http.Request) {
	limit := int64(10)
	offset := int64(0)

	if value := r.URL.Query().Get("limit"); value != "" {
		parsed, err := strconv.ParseInt(value, 10, 32)
		if err != nil || parsed < 1 || parsed > 100 {
			http.Error(w, "Invalid limit: must be between 1 and 100", http.StatusBadRequest)
			return
		}
		limit = parsed
	}

	if value := r.URL.Query().Get("offset"); value != "" {
		parsed, err := strconv.ParseInt(value, 10, 32)
		if err != nil || parsed < 0 {
			http.Error(w, "Invalid offset", http.StatusBadRequest)
			return
		}
		offset = parsed
	}

	kosts, err := h.service.ListPublished(r.Context(), int32(limit), int32(offset))
	if err != nil {
		http.Error(w, "Failed to retrieve kost listings", http.StatusInternalServerError)
		return
	}

	if kosts == nil {
		kosts = []db.Kost{}
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)

	if err := json.NewEncoder(w).Encode(map[string]interface{}{
		"status": "success",
		"data":   kosts,
	}); err != nil {
		return
	}
}
