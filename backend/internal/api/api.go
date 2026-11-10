package api

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/mail"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/golang-jwt/jwt/v5"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"
)

type API struct {
	DB         *pgxpool.Pool
	Secret     []byte
	TokenHours int
}

type ctxKey string

const userKey ctxKey = "auth_user"

type identity struct {
	ID   int64  `json:"id"`
	Role string `json:"role"`
}

type claims struct {
	Role string `json:"role"`
	jwt.RegisteredClaims
}

type envelope map[string]any

type kostImage struct {
	ID        int64     `json:"id"`
	KostID    int64     `json:"kost_id"`
	ImageURL  string    `json:"image_url"`
	SortOrder int32     `json:"sort_order"`
	CreatedAt time.Time `json:"created_at"`
}

func ok(w http.ResponseWriter, status int, data any) {
	write(w, status, envelope{
		"status": "success",
		"data":   data,
	})
}

func fail(w http.ResponseWriter, status int, code, message string) {
	write(w, status, envelope{
		"status": "error",
		"error": envelope{
			"code":    code,
			"message": message,
		},
	})
}

func write(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}

func decode(r *http.Request, value any) error {
	decoder := json.NewDecoder(io.LimitReader(r.Body, 1<<20))
	decoder.DisallowUnknownFields()

	if err := decoder.Decode(value); err != nil {
		return err
	}

	var extra any
	if err := decoder.Decode(&extra); err != io.EOF {
		return fmt.Errorf("request body must contain only one JSON value")
	}

	return nil
}

func idParam(r *http.Request) (int64, error) {
	id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err != nil || id < 1 {
		return 0, fmt.Errorf("invalid id")
	}
	return id, nil
}

func (a *API) token(id int64, role string) (string, error) {
	hours := a.TokenHours
	if hours <= 0 {
		hours = 24
	}

	now := time.Now()

	tokenClaims := claims{
		Role: role,
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   strconv.FormatInt(id, 10),
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(time.Duration(hours) * time.Hour)),
			Issuer:    "kostkita",
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, tokenClaims)
	return token.SignedString(a.Secret)
}

func (a *API) auth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		header := strings.TrimSpace(r.Header.Get("Authorization"))
		parts := strings.SplitN(header, " ", 2)

		if len(parts) != 2 ||
			!strings.EqualFold(parts[0], "Bearer") ||
			strings.TrimSpace(parts[1]) == "" {
			fail(w, http.StatusUnauthorized, "UNAUTHORIZED", "Bearer token is required")
			return
		}

		rawToken := strings.TrimSpace(parts[1])

		parsedToken, err := jwt.ParseWithClaims(
			rawToken,
			&claims{},
			func(token *jwt.Token) (any, error) {
				if token.Method.Alg() != jwt.SigningMethodHS256.Alg() {
					return nil, fmt.Errorf("unexpected signing method")
				}
				return a.Secret, nil
			},
			jwt.WithIssuer("kostkita"),
		)

		if err != nil || parsedToken == nil || !parsedToken.Valid {
			fail(w, http.StatusUnauthorized, "INVALID_TOKEN", "Token is invalid or expired")
			return
		}

		tokenClaims, valid := parsedToken.Claims.(*claims)
		if !valid {
			fail(w, http.StatusUnauthorized, "INVALID_TOKEN", "Invalid token claims")
			return
		}

		userID, err := strconv.ParseInt(tokenClaims.Subject, 10, 64)
		if err != nil || userID < 1 {
			fail(w, http.StatusUnauthorized, "INVALID_TOKEN", "Invalid token subject")
			return
		}

		ctx := context.WithValue(
			r.Context(),
			userKey,
			identity{ID: userID, Role: tokenClaims.Role},
		)

		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func (a *API) role(roles ...string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			user := current(r)

			for _, allowedRole := range roles {
				if user.Role == allowedRole {
					next.ServeHTTP(w, r)
					return
				}
			}

			fail(w, http.StatusForbidden, "FORBIDDEN",
				"You do not have permission to access this resource")
		})
	}
}

func current(r *http.Request) identity {
	user, _ := r.Context().Value(userKey).(identity)
	return user
}

func (a *API) Router() http.Handler {
	r := chi.NewRouter()

	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		ok(w, http.StatusOK, envelope{
			"message": "KostKita API is running",
		})
	})

	r.Route("/api/v1", func(v chi.Router) {
		v.Post("/auth/register", a.register)
		v.Post("/auth/login", a.login)

		// Public endpoints
		v.Get("/kosts", a.listKosts)
		v.Get("/kosts/{id}", a.getPublicKost)
		v.Get("/facilities", a.listFacilities)

		v.Group(func(p chi.Router) {
			p.Use(a.auth)

			p.Get("/auth/me", a.me)

			p.Post("/auth/logout", func(w http.ResponseWriter, r *http.Request) {
				ok(w, http.StatusOK, envelope{
					"message": "Logout client-side: discard the bearer token",
				})
			})

			// Owner endpoints
			p.Group(func(o chi.Router) {
				o.Use(a.role("owner"))

				o.Get("/owner/kosts", a.ownerList)
				o.Post("/owner/kosts", a.createKost)
				o.Get("/owner/kosts/{id}", a.ownerGet)
				o.Put("/owner/kosts/{id}", a.updateKost)
				o.Delete("/owner/kosts/{id}", a.deleteKost)

				o.Put("/owner/kosts/{id}/facilities", a.setKostFacilities)
				o.Post("/owner/kosts/{id}/images", a.addImage)
				o.Delete("/owner/kosts/{id}/images/{imageId}", a.deleteImage)
			})

			// Visitor endpoints
			p.Group(func(f chi.Router) {
				f.Use(a.role("visitor"))

				f.Get("/favorites", a.listFavorites)
				f.Post("/favorites/{kostId}", a.addFavorite)
				f.Delete("/favorites/{kostId}", a.removeFavorite)
			})

			// Admin endpoints
			p.Group(func(ad chi.Router) {
				ad.Use(a.role("admin"))

				ad.Get("/admin/users", a.adminUsers)
				ad.Get("/admin/kosts", a.adminListKosts)
				ad.Patch("/admin/users/{id}/role", a.adminSetRole)
				ad.Patch("/admin/kosts/{id}/status", a.adminSetKostStatus)
				ad.Delete("/admin/kosts/{id}", a.adminDeleteKost)

				ad.Post("/admin/facilities", a.adminCreateFacility)
				ad.Delete("/admin/facilities/{id}", a.adminDeleteFacility)
			})
		})
	})

	return r
}

// ==============================
// AUTHENTICATION
// ==============================

func (a *API) register(w http.ResponseWriter, r *http.Request) {
	var input struct {
		Name     string `json:"name"`
		Email    string `json:"email"`
		Password string `json:"password"`
		Phone    string `json:"phone"`
		Role     string `json:"role"`
	}

	if err := decode(r, &input); err != nil {
		fail(w, http.StatusBadRequest, "INVALID_BODY", "Invalid JSON body")
		return
	}

	input.Name = strings.TrimSpace(input.Name)
	input.Email = strings.ToLower(strings.TrimSpace(input.Email))
	input.Phone = strings.TrimSpace(input.Phone)
	input.Role = strings.TrimSpace(input.Role)

	if len(input.Name) < 2 || len(input.Name) > 100 {
		fail(w, http.StatusBadRequest, "VALIDATION_ERROR",
			"name must be 2–100 characters")
		return
	}

	if _, err := mail.ParseAddress(input.Email); err != nil {
		fail(w, http.StatusBadRequest, "VALIDATION_ERROR", "Valid email is required")
		return
	}

	if len(input.Password) < 8 || len(input.Password) > 72 {
		fail(w, http.StatusBadRequest, "VALIDATION_ERROR",
			"password must be 8–72 bytes")
		return
	}

	if input.Role != "owner" && input.Role != "visitor" {
		fail(w, http.StatusBadRequest, "VALIDATION_ERROR",
			"role must be owner or visitor")
		return
	}

	hash, err := bcrypt.GenerateFromPassword(
		[]byte(input.Password),
		bcrypt.DefaultCost,
	)
	if err != nil {
		fail(w, http.StatusInternalServerError, "INTERNAL_ERROR",
			"Could not secure password")
		return
	}

	var user struct {
		ID    int64   `json:"id"`
		Name  string  `json:"name"`
		Email string  `json:"email"`
		Phone *string `json:"phone"`
		Role  string  `json:"role"`
	}

	err = a.DB.QueryRow(
		r.Context(),
		`INSERT INTO users(role_id, name, email, password_hash, phone)
		 SELECT id, $1, $2, $3, NULLIF($4, '')
		 FROM roles
		 WHERE name = $5
		 RETURNING id, name, email, phone, $5`,
		input.Name,
		input.Email,
		string(hash),
		input.Phone,
		input.Role,
	).Scan(&user.ID, &user.Name, &user.Email, &user.Phone, &user.Role)

	if err != nil {
		if strings.Contains(strings.ToLower(err.Error()), "duplicate key") {
			fail(w, http.StatusConflict, "EMAIL_EXISTS", "Email is already registered")
		} else {
			fail(w, http.StatusInternalServerError, "DATABASE_ERROR",
				"Could not create account")
		}
		return
	}

	accessToken, err := a.token(user.ID, user.Role)
	if err != nil {
		fail(w, http.StatusInternalServerError, "TOKEN_ERROR",
			"Could not create access token")
		return
	}

	ok(w, http.StatusCreated, envelope{
		"user":         user,
		"access_token": accessToken,
		"token_type":   "Bearer",
	})
}

func (a *API) login(w http.ResponseWriter, r *http.Request) {
	var input struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}

	if err := decode(r, &input); err != nil {
		fail(w, http.StatusBadRequest, "INVALID_BODY", "Invalid JSON body")
		return
	}

	var user struct {
		ID    int64
		Name  string
		Email string
		Hash  string
		Role  string
	}

	err := a.DB.QueryRow(
		r.Context(),
		`SELECT u.id, u.name, u.email, u.password_hash, ro.name
		 FROM users u
		 JOIN roles ro ON ro.id = u.role_id
		 WHERE lower(u.email) = lower($1)`,
		strings.TrimSpace(input.Email),
	).Scan(
		&user.ID,
		&user.Name,
		&user.Email,
		&user.Hash,
		&user.Role,
	)

	if err != nil ||
		bcrypt.CompareHashAndPassword([]byte(user.Hash), []byte(input.Password)) != nil {
		fail(w, http.StatusUnauthorized, "INVALID_CREDENTIALS",
			"Email or password is incorrect")
		return
	}

	accessToken, err := a.token(user.ID, user.Role)
	if err != nil {
		fail(w, http.StatusInternalServerError, "TOKEN_ERROR",
			"Could not create access token")
		return
	}

	ok(w, http.StatusOK, envelope{
		"user": envelope{
			"id":    user.ID,
			"name":  user.Name,
			"email": user.Email,
			"role":  user.Role,
		},
		"access_token": accessToken,
		"token_type":   "Bearer",
	})
}

func (a *API) me(w http.ResponseWriter, r *http.Request) {
	user := current(r)

	var id int64
	var name, email string
	var phone *string
	var createdAt time.Time

	err := a.DB.QueryRow(
		r.Context(),
		`SELECT id, name, email, phone, created_at
		 FROM users
		 WHERE id = $1`,
		user.ID,
	).Scan(&id, &name, &email, &phone, &createdAt)

	if errors.Is(err, pgx.ErrNoRows) {
		fail(w, http.StatusNotFound, "USER_NOT_FOUND", "User not found")
		return
	}

	if err != nil {
		fail(w, http.StatusInternalServerError, "DATABASE_ERROR",
			"Could not retrieve profile")
		return
	}

	ok(w, http.StatusOK, envelope{
		"id":         id,
		"name":       name,
		"email":      email,
		"phone":      phone,
		"role":       user.Role,
		"created_at": createdAt,
	})
}

// ==============================
// KOST PUBLIC
// ==============================

const kostSelect = `
	SELECT
		id,
		owner_id,
		name,
		description,
		price,
		address,
		city,
		province,
		available_rooms,
		status,
		created_at,
		updated_at
	FROM kosts
`

func scanKost(row pgx.Row) (envelope, error) {
	var (
		id, ownerID, price                    int64
		name, address, city, province, status string
		description                           *string
		rooms                                 int32
		createdAt, updatedAt                  time.Time
	)

	err := row.Scan(
		&id,
		&ownerID,
		&name,
		&description,
		&price,
		&address,
		&city,
		&province,
		&rooms,
		&status,
		&createdAt,
		&updatedAt,
	)
	if err != nil {
		return nil, err
	}

	return envelope{
		"id":              id,
		"owner_id":        ownerID,
		"name":            name,
		"description":     description,
		"price":           price,
		"address":         address,
		"city":            city,
		"province":        province,
		"available_rooms": rooms,
		"status":          status,
		"created_at":      createdAt,
		"updated_at":      updatedAt,
	}, nil
}

func (a *API) getKostImages(ctx context.Context, kostID int64) ([]kostImage, error) {
	rows, err := a.DB.Query(
		ctx,
		`SELECT id, kost_id, image_url, sort_order, created_at
		 FROM kost_images
		 WHERE kost_id = $1
		 ORDER BY sort_order ASC, id ASC`,
		kostID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	images := []kostImage{}

	for rows.Next() {
		var image kostImage

		if err := rows.Scan(
			&image.ID,
			&image.KostID,
			&image.ImageURL,
			&image.SortOrder,
			&image.CreatedAt,
		); err != nil {
			return nil, err
		}

		images = append(images, image)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return images, nil
}

func (a *API) listKosts(w http.ResponseWriter, r *http.Request) {
	query := r.URL.Query()

	limit := int64(12)
	offset := int64(0)

	var err error

	if query.Get("limit") != "" {
		limit, err = strconv.ParseInt(query.Get("limit"), 10, 32)
		if err != nil || limit < 1 || limit > 100 {
			fail(w, http.StatusBadRequest, "INVALID_LIMIT",
				"limit must be between 1 and 100")
			return
		}
	}

	if query.Get("offset") != "" {
		offset, err = strconv.ParseInt(query.Get("offset"), 10, 32)
		if err != nil || offset < 0 {
			fail(w, http.StatusBadRequest, "INVALID_OFFSET",
				"offset must be zero or greater")
			return
		}
	}

	var minPrice, maxPrice int64

	if query.Get("min_price") != "" {
		minPrice, err = strconv.ParseInt(query.Get("min_price"), 10, 64)
		if err != nil || minPrice < 0 {
			fail(w, http.StatusBadRequest, "INVALID_MIN_PRICE",
				"min_price must be zero or greater")
			return
		}
	}

	if query.Get("max_price") != "" {
		maxPrice, err = strconv.ParseInt(query.Get("max_price"), 10, 64)
		if err != nil || maxPrice < 0 {
			fail(w, http.StatusBadRequest, "INVALID_MAX_PRICE",
				"max_price must be zero or greater")
			return
		}
	}

	if maxPrice > 0 && minPrice > maxPrice {
		fail(w, http.StatusBadRequest, "INVALID_PRICE_RANGE",
			"min_price cannot be greater than max_price")
		return
	}

	city := strings.TrimSpace(query.Get("city"))
	province := strings.TrimSpace(query.Get("province"))
	keyword := strings.TrimSpace(query.Get("q"))

	rows, err := a.DB.Query(
		r.Context(),
		`SELECT
			k.id, k.owner_id, k.name, k.description, k.price,
			k.address, k.city, k.province, k.available_rooms,
			k.status, k.created_at, k.updated_at
		 FROM kosts k
		 WHERE k.status = 'published'
		   AND ($1 = '' OR k.city ILIKE '%' || $1 || '%')
		   AND ($2 = '' OR k.province ILIKE '%' || $2 || '%')
		   AND ($3 = '' OR
				(k.name || ' ' || k.address || ' ' || k.city)
				ILIKE '%' || $3 || '%')
		   AND ($4 = 0 OR k.price >= $4)
		   AND ($5 = 0 OR k.price <= $5)
		 ORDER BY k.created_at DESC
		 LIMIT $6 OFFSET $7`,
		city,
		province,
		keyword,
		minPrice,
		maxPrice,
		limit,
		offset,
	)
	if err != nil {
		fail(w, http.StatusInternalServerError, "DATABASE_ERROR",
			"Could not list kosts")
		return
	}
	defer rows.Close()

	items := []envelope{}

	for rows.Next() {
		kost, err := scanKost(rows)
		if err != nil {
			fail(w, http.StatusInternalServerError, "DATABASE_ERROR",
				"Could not read kosts")
			return
		}

		images, err := a.getKostImages(r.Context(), kost["id"].(int64))
		if err != nil {
			fail(w, http.StatusInternalServerError, "DATABASE_ERROR",
				"Could not retrieve kost images")
			return
		}

		kost["images"] = images
		items = append(items, kost)
	}

	if err := rows.Err(); err != nil {
		fail(w, http.StatusInternalServerError, "DATABASE_ERROR",
			"Could not read kosts")
		return
	}

	ok(w, http.StatusOK, items)
}

func (a *API) getPublicKost(w http.ResponseWriter, r *http.Request) {
	id, err := idParam(r)
	if err != nil {
		fail(w, http.StatusBadRequest, "INVALID_ID",
			"ID must be a positive integer")
		return
	}

	kost, err := scanKost(
		a.DB.QueryRow(
			r.Context(),
			kostSelect+` WHERE id = $1 AND status = 'published'`,
			id,
		),
	)

	if errors.Is(err, pgx.ErrNoRows) {
		fail(w, http.StatusNotFound, "KOST_NOT_FOUND",
			"Published kost was not found")
		return
	}

	if err != nil {
		fail(w, http.StatusInternalServerError, "DATABASE_ERROR",
			"Could not retrieve kost")
		return
	}

	images, err := a.getKostImages(r.Context(), id)
	if err != nil {
		fail(w, http.StatusInternalServerError, "DATABASE_ERROR",
			"Could not retrieve kost images")
		return
	}

	kost["images"] = images
	ok(w, http.StatusOK, kost)
}

// ==============================
// KOST OWNER
// ==============================

func (a *API) ownerList(w http.ResponseWriter, r *http.Request) {
	user := current(r)

	rows, err := a.DB.Query(
		r.Context(),
		kostSelect+` WHERE owner_id = $1 ORDER BY created_at DESC`,
		user.ID,
	)
	if err != nil {
		fail(w, http.StatusInternalServerError, "DATABASE_ERROR",
			"Could not list your kosts")
		return
	}
	defer rows.Close()

	out := []envelope{}

	for rows.Next() {
		kost, err := scanKost(rows)
		if err != nil {
			fail(w, http.StatusInternalServerError, "DATABASE_ERROR",
				"Could not read kosts")
			return
		}

		images, err := a.getKostImages(r.Context(), kost["id"].(int64))
		if err != nil {
			fail(w, http.StatusInternalServerError, "DATABASE_ERROR",
				"Could not retrieve kost images")
			return
		}

		kost["images"] = images
		out = append(out, kost)
	}

	if err := rows.Err(); err != nil {
		fail(w, http.StatusInternalServerError, "DATABASE_ERROR",
			"Could not read kosts")
		return
	}

	ok(w, http.StatusOK, out)
}

type kostInput struct {
	Name           string  `json:"name"`
	Description    *string `json:"description"`
	Price          int64   `json:"price"`
	Address        string  `json:"address"`
	City           string  `json:"city"`
	Province       string  `json:"province"`
	AvailableRooms int32   `json:"available_rooms"`
}

func validateKost(input kostInput) string {
	input.Name = strings.TrimSpace(input.Name)

	if input.Name == "" || len(input.Name) > 150 {
		return "name is required (max 150 characters)"
	}

	if input.Price < 0 {
		return "price must be zero or greater"
	}

	if strings.TrimSpace(input.Address) == "" ||
		strings.TrimSpace(input.City) == "" ||
		strings.TrimSpace(input.Province) == "" {
		return "address, city, and province are required"
	}

	if input.AvailableRooms < 0 {
		return "available_rooms must be zero or greater"
	}

	return ""
}

func (a *API) createKost(w http.ResponseWriter, r *http.Request) {
	user := current(r)

	var input kostInput

	if err := decode(r, &input); err != nil {
		fail(w, http.StatusBadRequest, "INVALID_BODY", "Invalid JSON body")
		return
	}

	if message := validateKost(input); message != "" {
		fail(w, http.StatusBadRequest, "VALIDATION_ERROR", message)
		return
	}

	input.Name = strings.TrimSpace(input.Name)
	input.Address = strings.TrimSpace(input.Address)
	input.City = strings.TrimSpace(input.City)
	input.Province = strings.TrimSpace(input.Province)

	if input.Description != nil {
		description := strings.TrimSpace(*input.Description)
		input.Description = &description
	}

	kost, err := scanKost(
		a.DB.QueryRow(
			r.Context(),
			`INSERT INTO kosts(
				owner_id, name, description, price, address,
				city, province, available_rooms
			)
			VALUES($1,$2,$3,$4,$5,$6,$7,$8)
			RETURNING
				id, owner_id, name, description, price, address,
				city, province, available_rooms, status,
				created_at, updated_at`,
			user.ID,
			input.Name,
			input.Description,
			input.Price,
			input.Address,
			input.City,
			input.Province,
			input.AvailableRooms,
		),
	)

	if err != nil {
		fail(w, http.StatusInternalServerError, "DATABASE_ERROR",
			"Could not create kost")
		return
	}

	kost["images"] = []kostImage{}
	ok(w, http.StatusCreated, kost)
}

func (a *API) ownerGet(w http.ResponseWriter, r *http.Request) {
	user := current(r)

	id, err := idParam(r)
	if err != nil {
		fail(w, http.StatusBadRequest, "INVALID_ID", "Invalid kost ID")
		return
	}

	kost, err := scanKost(
		a.DB.QueryRow(
			r.Context(),
			kostSelect+` WHERE id = $1 AND owner_id = $2`,
			id,
			user.ID,
		),
	)

	if errors.Is(err, pgx.ErrNoRows) {
		fail(w, http.StatusNotFound, "KOST_NOT_FOUND", "Kost not found")
		return
	}

	if err != nil {
		fail(w, http.StatusInternalServerError, "DATABASE_ERROR",
			"Could not retrieve kost")
		return
	}

	images, err := a.getKostImages(r.Context(), id)
	if err != nil {
		fail(w, http.StatusInternalServerError, "DATABASE_ERROR",
			"Could not retrieve kost images")
		return
	}

	kost["images"] = images
	ok(w, http.StatusOK, kost)
}

func (a *API) updateKost(w http.ResponseWriter, r *http.Request) {
	user := current(r)

	id, err := idParam(r)
	if err != nil {
		fail(w, http.StatusBadRequest, "INVALID_ID", "Invalid kost ID")
		return
	}

	var input kostInput

	if err := decode(r, &input); err != nil {
		fail(w, http.StatusBadRequest, "INVALID_BODY", "Invalid JSON body")
		return
	}

	if message := validateKost(input); message != "" {
		fail(w, http.StatusBadRequest, "VALIDATION_ERROR", message)
		return
	}

	input.Name = strings.TrimSpace(input.Name)
	input.Address = strings.TrimSpace(input.Address)
	input.City = strings.TrimSpace(input.City)
	input.Province = strings.TrimSpace(input.Province)

	if input.Description != nil {
		description := strings.TrimSpace(*input.Description)
		input.Description = &description
	}

	kost, err := scanKost(
		a.DB.QueryRow(
			r.Context(),
			`UPDATE kosts
			 SET name = $3,
				 description = $4,
				 price = $5,
				 address = $6,
				 city = $7,
				 province = $8,
				 available_rooms = $9,
				 updated_at = NOW()
			 WHERE id = $1 AND owner_id = $2
			 RETURNING
				id, owner_id, name, description, price, address,
				city, province, available_rooms, status,
				created_at, updated_at`,
			id,
			user.ID,
			input.Name,
			input.Description,
			input.Price,
			input.Address,
			input.City,
			input.Province,
			input.AvailableRooms,
		),
	)

	if errors.Is(err, pgx.ErrNoRows) {
		fail(w, http.StatusNotFound, "KOST_NOT_FOUND", "Kost not found")
		return
	}

	if err != nil {
		fail(w, http.StatusInternalServerError, "DATABASE_ERROR",
			"Could not update kost")
		return
	}

	images, err := a.getKostImages(r.Context(), id)
	if err != nil {
		fail(w, http.StatusInternalServerError, "DATABASE_ERROR",
			"Could not retrieve kost images")
		return
	}

	kost["images"] = images
	ok(w, http.StatusOK, kost)
}

func (a *API) deleteKost(w http.ResponseWriter, r *http.Request) {
	user := current(r)

	id, err := idParam(r)
	if err != nil {
		fail(w, http.StatusBadRequest, "INVALID_ID", "Invalid kost ID")
		return
	}

	tag, err := a.DB.Exec(
		r.Context(),
		`DELETE FROM kosts WHERE id = $1 AND owner_id = $2`,
		id,
		user.ID,
	)
	if err != nil {
		fail(w, http.StatusInternalServerError, "DATABASE_ERROR",
			"Could not delete kost")
		return
	}

	if tag.RowsAffected() == 0 {
		fail(w, http.StatusNotFound, "KOST_NOT_FOUND", "Kost not found")
		return
	}

	ok(w, http.StatusOK, envelope{"message": "Kost deleted"})
}

// ==============================
// FACILITIES
// ==============================

func (a *API) listFacilities(w http.ResponseWriter, r *http.Request) {
	rows, err := a.DB.Query(
		r.Context(),
		`SELECT id, name, created_at FROM facilities ORDER BY name`,
	)
	if err != nil {
		fail(w, http.StatusInternalServerError, "DATABASE_ERROR",
			"Could not list facilities")
		return
	}
	defer rows.Close()

	out := []envelope{}

	for rows.Next() {
		var (
			id        int64
			name      string
			createdAt time.Time
		)

		if err := rows.Scan(&id, &name, &createdAt); err != nil {
			fail(w, http.StatusInternalServerError, "DATABASE_ERROR",
				"Could not read facilities")
			return
		}

		out = append(out, envelope{
			"id":         id,
			"name":       name,
			"created_at": createdAt,
		})
	}

	if err := rows.Err(); err != nil {
		fail(w, http.StatusInternalServerError, "DATABASE_ERROR",
			"Could not read facilities")
		return
	}

	ok(w, http.StatusOK, out)
}

func (a *API) setKostFacilities(w http.ResponseWriter, r *http.Request) {
	user := current(r)

	id, err := idParam(r)
	if err != nil {
		fail(w, http.StatusBadRequest, "INVALID_ID", "Invalid kost ID")
		return
	}

	var input struct {
		FacilityIDs []int64 `json:"facility_ids"`
	}

	if err := decode(r, &input); err != nil {
		fail(w, http.StatusBadRequest, "INVALID_BODY",
			"Expected facility_ids array")
		return
	}

	// Validasi ID fasilitas dan cegah ID duplikat.
	seen := make(map[int64]bool)

	for _, facilityID := range input.FacilityIDs {
		if facilityID < 1 || seen[facilityID] {
			fail(w, http.StatusBadRequest, "INVALID_FACILITY",
				"Facility IDs must be positive and unique")
			return
		}
		seen[facilityID] = true
	}

	tx, err := a.DB.Begin(r.Context())
	if err != nil {
		fail(w, http.StatusInternalServerError, "DATABASE_ERROR",
			"Could not start transaction")
		return
	}
	defer tx.Rollback(r.Context())

	var exists bool

	err = tx.QueryRow(
		r.Context(),
		`SELECT EXISTS(
			SELECT 1 FROM kosts WHERE id = $1 AND owner_id = $2
		)`,
		id,
		user.ID,
	).Scan(&exists)

	if err != nil {
		fail(w, http.StatusInternalServerError, "DATABASE_ERROR",
			"Could not verify kost")
		return
	}

	if !exists {
		fail(w, http.StatusNotFound, "KOST_NOT_FOUND", "Kost not found")
		return
	}

	// Pastikan semua fasilitas tersedia sebelum mengganti relasi.
	if len(input.FacilityIDs) > 0 {
		var count int

		err = tx.QueryRow(
			r.Context(),
			`SELECT COUNT(*) FROM facilities WHERE id = ANY($1)`,
			input.FacilityIDs,
		).Scan(&count)

		if err != nil {
			fail(w, http.StatusInternalServerError, "DATABASE_ERROR",
				"Could not verify facilities")
			return
		}

		if count != len(input.FacilityIDs) {
			fail(w, http.StatusBadRequest, "INVALID_FACILITY",
				"One or more facilities do not exist")
			return
		}
	}

	_, err = tx.Exec(
		r.Context(),
		`DELETE FROM kost_facilities WHERE kost_id = $1`,
		id,
	)
	if err != nil {
		fail(w, http.StatusInternalServerError, "DATABASE_ERROR",
			"Could not update facilities")
		return
	}

	for _, facilityID := range input.FacilityIDs {
		_, err = tx.Exec(
			r.Context(),
			`INSERT INTO kost_facilities(kost_id, facility_id)
			 VALUES($1, $2)`,
			id,
			facilityID,
		)
		if err != nil {
			fail(w, http.StatusInternalServerError, "DATABASE_ERROR",
				"Could not save facilities")
			return
		}
	}

	if err := tx.Commit(r.Context()); err != nil {
		fail(w, http.StatusInternalServerError, "DATABASE_ERROR",
			"Could not save facilities")
		return
	}

	ok(w, http.StatusOK, envelope{
		"message":      "Facilities updated",
		"facility_ids": input.FacilityIDs,
	})
}

// ==============================
// KOST IMAGES
// ==============================

func (a *API) addImage(w http.ResponseWriter, r *http.Request) {
	user := current(r)

	id, err := idParam(r)
	if err != nil {
		fail(w, http.StatusBadRequest, "INVALID_ID", "Invalid kost ID")
		return
	}

	var input struct {
		URL  string `json:"image_url"`
		Sort int32  `json:"sort_order"`
	}

	if err := decode(r, &input); err != nil {
		fail(w, http.StatusBadRequest, "INVALID_BODY", "Invalid JSON body")
		return
	}

	input.URL = strings.TrimSpace(input.URL)

	parsedURL, err := url.ParseRequestURI(input.URL)
	if err != nil ||
		(parsedURL.Scheme != "https" && parsedURL.Scheme != "http") ||
		parsedURL.Host == "" {
		fail(w, http.StatusBadRequest, "VALIDATION_ERROR",
			"image_url must be a valid http or https URL")
		return
	}

	if parsedURL.User != nil {
		fail(w, http.StatusBadRequest, "VALIDATION_ERROR",
			"image_url must not contain embedded credentials")
		return
	}

	if input.Sort < 0 {
		fail(w, http.StatusBadRequest, "VALIDATION_ERROR",
			"sort_order must be zero or greater")
		return
	}

	var image kostImage

	err = a.DB.QueryRow(
		r.Context(),
		`INSERT INTO kost_images(kost_id, image_url, sort_order)
		 SELECT id, $2, $3
		 FROM kosts
		 WHERE id = $1 AND owner_id = $4
		 RETURNING id, kost_id, image_url, sort_order, created_at`,
		id,
		input.URL,
		input.Sort,
		user.ID,
	).Scan(
		&image.ID,
		&image.KostID,
		&image.ImageURL,
		&image.SortOrder,
		&image.CreatedAt,
	)

	if errors.Is(err, pgx.ErrNoRows) {
		fail(w, http.StatusNotFound, "KOST_NOT_FOUND", "Kost not found")
		return
	}

	if err != nil {
		fail(w, http.StatusInternalServerError, "DATABASE_ERROR",
			"Could not add image")
		return
	}

	ok(w, http.StatusCreated, image)
}

func (a *API) deleteImage(w http.ResponseWriter, r *http.Request) {
	user := current(r)

	id, err := idParam(r)
	if err != nil {
		fail(w, http.StatusBadRequest, "INVALID_ID", "Invalid kost ID")
		return
	}

	imageID, err := strconv.ParseInt(chi.URLParam(r, "imageId"), 10, 64)
	if err != nil || imageID < 1 {
		fail(w, http.StatusBadRequest, "INVALID_ID", "Invalid image ID")
		return
	}

	tag, err := a.DB.Exec(
		r.Context(),
		`DELETE FROM kost_images i
		 USING kosts k
		 WHERE i.id = $1
		   AND i.kost_id = k.id
		   AND k.owner_id = $2
		   AND k.id = $3`,
		imageID,
		user.ID,
		id,
	)
	if err != nil {
		fail(w, http.StatusInternalServerError, "DATABASE_ERROR",
			"Could not delete image")
		return
	}

	if tag.RowsAffected() == 0 {
		fail(w, http.StatusNotFound, "IMAGE_NOT_FOUND", "Image not found")
		return
	}

	ok(w, http.StatusOK, envelope{"message": "Image deleted"})
}

// ==============================
// FAVORITES
// ==============================

func (a *API) listFavorites(w http.ResponseWriter, r *http.Request) {
	user := current(r)

	rows, err := a.DB.Query(
		r.Context(),
		`SELECT
			k.id, k.owner_id, k.name, k.description, k.price,
			k.address, k.city, k.province, k.available_rooms,
			k.status, k.created_at, k.updated_at
		 FROM favorites f
		 JOIN kosts k ON k.id = f.kost_id
		 WHERE f.user_id = $1
		 ORDER BY f.created_at DESC`,
		user.ID,
	)
	if err != nil {
		fail(w, http.StatusInternalServerError, "DATABASE_ERROR",
			"Could not list favorites")
		return
	}
	defer rows.Close()

	out := []envelope{}

	for rows.Next() {
		kost, err := scanKost(rows)
		if err != nil {
			fail(w, http.StatusInternalServerError, "DATABASE_ERROR",
				"Could not read favorites")
			return
		}

		images, err := a.getKostImages(r.Context(), kost["id"].(int64))
		if err != nil {
			fail(w, http.StatusInternalServerError, "DATABASE_ERROR",
				"Could not retrieve kost images")
			return
		}

		kost["images"] = images
		out = append(out, kost)
	}

	if err := rows.Err(); err != nil {
		fail(w, http.StatusInternalServerError, "DATABASE_ERROR",
			"Could not read favorites")
		return
	}

	ok(w, http.StatusOK, out)
}

func (a *API) addFavorite(w http.ResponseWriter, r *http.Request) {
	user := current(r)

	id, err := strconv.ParseInt(chi.URLParam(r, "kostId"), 10, 64)
	if err != nil || id < 1 {
		fail(w, http.StatusBadRequest, "INVALID_ID", "Invalid kost ID")
		return
	}

	tag, err := a.DB.Exec(
		r.Context(),
		`INSERT INTO favorites(user_id, kost_id)
		 SELECT $1, id
		 FROM kosts
		 WHERE id = $2 AND status = 'published'
		 ON CONFLICT DO NOTHING`,
		user.ID,
		id,
	)
	if err != nil {
		fail(w, http.StatusInternalServerError, "DATABASE_ERROR",
			"Could not add favorite")
		return
	}

	if tag.RowsAffected() == 0 {
		var exists bool

		err = a.DB.QueryRow(
			r.Context(),
			`SELECT EXISTS(
				SELECT 1 FROM favorites
				WHERE user_id = $1 AND kost_id = $2
			)`,
			user.ID,
			id,
		).Scan(&exists)

		if err != nil {
			fail(w, http.StatusInternalServerError, "DATABASE_ERROR",
				"Could not verify favorite")
			return
		}

		if !exists {
			fail(w, http.StatusNotFound, "KOST_NOT_FOUND",
				"Published kost not found")
			return
		}
	}

	ok(w, http.StatusCreated, envelope{
		"kost_id":   id,
		"favorited": true,
	})
}

func (a *API) removeFavorite(w http.ResponseWriter, r *http.Request) {
	user := current(r)

	id, err := strconv.ParseInt(chi.URLParam(r, "kostId"), 10, 64)
	if err != nil || id < 1 {
		fail(w, http.StatusBadRequest, "INVALID_ID", "Invalid kost ID")
		return
	}

	tag, err := a.DB.Exec(
		r.Context(),
		`DELETE FROM favorites
		 WHERE user_id = $1 AND kost_id = $2`,
		user.ID,
		id,
	)
	if err != nil {
		fail(w, http.StatusInternalServerError, "DATABASE_ERROR",
			"Could not remove favorite")
		return
	}

	if tag.RowsAffected() == 0 {
		fail(w, http.StatusNotFound, "FAVORITE_NOT_FOUND",
			"Favorite not found")
		return
	}

	ok(w, http.StatusOK, envelope{
		"kost_id":   id,
		"favorited": false,
	})
}

// ==============================
// ADMIN - USERS
// ==============================

func (a *API) adminUsers(w http.ResponseWriter, r *http.Request) {
	rows, err := a.DB.Query(
		r.Context(),
		`SELECT
			u.id, u.name, u.email, u.phone,
			ro.name, u.created_at
		 FROM users u
		 JOIN roles ro ON ro.id = u.role_id
		 ORDER BY u.created_at DESC
		 LIMIT 100`,
	)
	if err != nil {
		fail(w, http.StatusInternalServerError, "DATABASE_ERROR",
			"Could not list users")
		return
	}
	defer rows.Close()

	out := []envelope{}

	for rows.Next() {
		var (
			id                int64
			name, email, role string
			phone             *string
			createdAt         time.Time
		)

		if err := rows.Scan(
			&id,
			&name,
			&email,
			&phone,
			&role,
			&createdAt,
		); err != nil {
			fail(w, http.StatusInternalServerError, "DATABASE_ERROR",
				"Could not read users")
			return
		}

		out = append(out, envelope{
			"id":         id,
			"name":       name,
			"email":      email,
			"phone":      phone,
			"role":       role,
			"created_at": createdAt,
		})
	}

	if err := rows.Err(); err != nil {
		fail(w, http.StatusInternalServerError, "DATABASE_ERROR",
			"Could not read users")
		return
	}

	ok(w, http.StatusOK, out)
}

func (a *API) adminSetRole(w http.ResponseWriter, r *http.Request) {
	id, err := idParam(r)
	if err != nil {
		fail(w, http.StatusBadRequest, "INVALID_ID", "Invalid user ID")
		return
	}

	var input struct {
		Role string `json:"role"`
	}

	if err := decode(r, &input); err != nil {
		fail(w, http.StatusBadRequest, "INVALID_BODY", "Invalid JSON body")
		return
	}

	input.Role = strings.TrimSpace(input.Role)

	if input.Role != "admin" &&
		input.Role != "owner" &&
		input.Role != "visitor" {
		fail(w, http.StatusBadRequest, "VALIDATION_ERROR",
			"role must be admin, owner, or visitor")
		return
	}

	tag, err := a.DB.Exec(
		r.Context(),
		`UPDATE users
		 SET role_id = (
			SELECT id FROM roles WHERE name = $2
		 ),
		 updated_at = NOW()
		 WHERE id = $1`,
		id,
		input.Role,
	)
	if err != nil {
		fail(w, http.StatusInternalServerError, "DATABASE_ERROR",
			"Could not update role")
		return
	}

	if tag.RowsAffected() == 0 {
		fail(w, http.StatusNotFound, "USER_NOT_FOUND", "User not found")
		return
	}

	ok(w, http.StatusOK, envelope{
		"user_id": id,
		"role":    input.Role,
	})
}

// ==============================
// ADMIN - KOSTS
// ==============================

func (a *API) adminListKosts(w http.ResponseWriter, r *http.Request) {
	rows, err := a.DB.Query(
		r.Context(),
		`SELECT
			k.id,
			k.owner_id,
			k.name,
			k.description,
			k.price,
			k.address,
			k.city,
			k.province,
			k.available_rooms,
			k.status,
			k.created_at,
			k.updated_at,
			u.name,
			u.phone
		 FROM kosts k
		 JOIN users u ON u.id = k.owner_id
		 ORDER BY k.created_at DESC`,
	)
	if err != nil {
		fail(w, http.StatusInternalServerError, "DATABASE_ERROR",
			"Could not list kosts")
		return
	}
	defer rows.Close()

	out := []envelope{}

	for rows.Next() {
		var (
			id, ownerID, price                    int64
			name, address, city, province, status string
			description                           *string
			rooms                                 int32
			createdAt, updatedAt                  time.Time
			ownerName                             string
			ownerPhone                            *string
		)

		if err := rows.Scan(
			&id,
			&ownerID,
			&name,
			&description,
			&price,
			&address,
			&city,
			&province,
			&rooms,
			&status,
			&createdAt,
			&updatedAt,
			&ownerName,
			&ownerPhone,
		); err != nil {
			fail(w, http.StatusInternalServerError, "DATABASE_ERROR",
				"Could not read kosts")
			return
		}

		images, err := a.getKostImages(r.Context(), id)
		if err != nil {
			fail(w, http.StatusInternalServerError, "DATABASE_ERROR",
				"Could not retrieve kost images")
			return
		}

		out = append(out, envelope{
			"id":              id,
			"owner_id":        ownerID,
			"name":            name,
			"description":     description,
			"price":           price,
			"address":         address,
			"city":            city,
			"province":        province,
			"available_rooms": rooms,
			"status":          status,
			"created_at":      createdAt,
			"updated_at":      updatedAt,
			"owner": envelope{
				"name":  ownerName,
				"phone": ownerPhone,
			},
			"images": images,
		})
	}

	if err := rows.Err(); err != nil {
		fail(w, http.StatusInternalServerError, "DATABASE_ERROR",
			"Could not read kosts")
		return
	}

	ok(w, http.StatusOK, out)
}

func (a *API) adminSetKostStatus(w http.ResponseWriter, r *http.Request) {
	id, err := idParam(r)
	if err != nil {
		fail(w, http.StatusBadRequest, "INVALID_ID", "Invalid kost ID")
		return
	}

	var input struct {
		Status string `json:"status"`
	}

	if err := decode(r, &input); err != nil {
		fail(w, http.StatusBadRequest, "INVALID_BODY", "Invalid JSON body")
		return
	}

	input.Status = strings.TrimSpace(input.Status)

	if input.Status != "draft" &&
		input.Status != "published" &&
		input.Status != "archived" {
		fail(w, http.StatusBadRequest, "VALIDATION_ERROR",
			"status must be draft, published, or archived")
		return
	}

	tag, err := a.DB.Exec(
		r.Context(),
		`UPDATE kosts
		 SET status = $2, updated_at = NOW()
		 WHERE id = $1`,
		id,
		input.Status,
	)
	if err != nil {
		fail(w, http.StatusInternalServerError, "DATABASE_ERROR",
			"Could not update status")
		return
	}

	if tag.RowsAffected() == 0 {
		fail(w, http.StatusNotFound, "KOST_NOT_FOUND", "Kost not found")
		return
	}

	ok(w, http.StatusOK, envelope{
		"kost_id": id,
		"status":  input.Status,
	})
}

func (a *API) adminDeleteKost(w http.ResponseWriter, r *http.Request) {
	id, err := idParam(r)
	if err != nil {
		fail(w, http.StatusBadRequest, "INVALID_ID", "Invalid kost ID")
		return
	}

	tag, err := a.DB.Exec(
		r.Context(),
		`DELETE FROM kosts WHERE id = $1`,
		id,
	)
	if err != nil {
		fail(w, http.StatusInternalServerError, "DATABASE_ERROR",
			"Could not delete kost")
		return
	}

	if tag.RowsAffected() == 0 {
		fail(w, http.StatusNotFound, "KOST_NOT_FOUND", "Kost not found")
		return
	}

	ok(w, http.StatusOK, envelope{"message": "Kost deleted"})
}

// ==============================
// ADMIN - FACILITIES
// ==============================

func (a *API) adminCreateFacility(w http.ResponseWriter, r *http.Request) {
	var input struct {
		Name string `json:"name"`
	}

	if err := decode(r, &input); err != nil {
		fail(w, http.StatusBadRequest, "INVALID_BODY", "Invalid JSON body")
		return
	}

	input.Name = strings.TrimSpace(input.Name)

	if input.Name == "" || len(input.Name) > 100 {
		fail(w, http.StatusBadRequest, "VALIDATION_ERROR",
			"facility name is required (max 100 characters)")
		return
	}

	var (
		id        int64
		name      string
		createdAt time.Time
	)

	err := a.DB.QueryRow(
		r.Context(),
		`INSERT INTO facilities(name)
		 VALUES($1)
		 RETURNING id, name, created_at`,
		input.Name,
	).Scan(&id, &name, &createdAt)

	if err != nil {
		if strings.Contains(strings.ToLower(err.Error()), "duplicate key") {
			fail(w, http.StatusConflict, "FACILITY_EXISTS",
				"Facility already exists")
		} else {
			fail(w, http.StatusInternalServerError, "DATABASE_ERROR",
				"Could not create facility")
		}
		return
	}

	ok(w, http.StatusCreated, envelope{
		"id":         id,
		"name":       name,
		"created_at": createdAt,
	})
}

func (a *API) adminDeleteFacility(w http.ResponseWriter, r *http.Request) {
	id, err := idParam(r)
	if err != nil {
		fail(w, http.StatusBadRequest, "INVALID_ID", "Invalid facility ID")
		return
	}

	tag, err := a.DB.Exec(
		r.Context(),
		`DELETE FROM facilities WHERE id = $1`,
		id,
	)
	if err != nil {
		fail(w, http.StatusInternalServerError, "DATABASE_ERROR",
			"Could not delete facility")
		return
	}

	if tag.RowsAffected() == 0 {
		fail(w, http.StatusNotFound, "FACILITY_NOT_FOUND",
			"Facility not found")
		return
	}

	ok(w, http.StatusOK, envelope{"message": "Facility deleted"})
}
