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

func ok(w http.ResponseWriter, status int, data any) {
	write(w, status, envelope{"status": "success", "data": data})
}
func fail(w http.ResponseWriter, status int, code, msg string) {
	write(w, status, envelope{"status": "error", "error": envelope{"code": code, "message": msg}})
}
func write(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}
func decode(r *http.Request, v any) error {
	d := json.NewDecoder(io.LimitReader(r.Body, 1<<20))
	d.DisallowUnknownFields()
	return d.Decode(v)
}
func idParam(r *http.Request) (int64, error) {
	id, e := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if e != nil || id < 1 {
		return 0, fmt.Errorf("invalid id")
	}
	return id, nil
}
func (a *API) token(id int64, role string) (string, error) {
	now := time.Now()
	c := claims{Role: role, RegisteredClaims: jwt.RegisteredClaims{Subject: strconv.FormatInt(id, 10), IssuedAt: jwt.NewNumericDate(now), ExpiresAt: jwt.NewNumericDate(now.Add(time.Duration(a.TokenHours) * time.Hour)), Issuer: "kostkita"}}
	return jwt.NewWithClaims(jwt.SigningMethodHS256, c).SignedString(a.Secret)
}
func (a *API) auth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		h := strings.TrimSpace(strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer "))
		if h == "" || h == r.Header.Get("Authorization") {
			fail(w, 401, "UNAUTHORIZED", "Bearer token is required")
			return
		}
		t, e := jwt.ParseWithClaims(h, &claims{}, func(t *jwt.Token) (any, error) {
			if t.Method.Alg() != jwt.SigningMethodHS256.Alg() {
				return nil, fmt.Errorf("unexpected signing method")
			}
			return a.Secret, nil
		})
		if e != nil || !t.Valid {
			fail(w, 401, "INVALID_TOKEN", "Token is invalid or expired")
			return
		}
		c, yes := t.Claims.(*claims)
		if !yes {
			fail(w, 401, "INVALID_TOKEN", "Invalid token claims")
			return
		}
		uid, e := strconv.ParseInt(c.Subject, 10, 64)
		if e != nil {
			fail(w, 401, "INVALID_TOKEN", "Invalid token subject")
			return
		}
		ctx := context.WithValue(r.Context(), userKey, identity{uid, c.Role})
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}
func (a *API) role(roles ...string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			u, _ := r.Context().Value(userKey).(identity)
			for _, role := range roles {
				if u.Role == role {
					next.ServeHTTP(w, r)
					return
				}
			}
			fail(w, 403, "FORBIDDEN", "You do not have permission to access this resource")
		})
	}
}
func current(r *http.Request) identity { u, _ := r.Context().Value(userKey).(identity); return u }
func (a *API) Router() http.Handler {
	r := chi.NewRouter()
	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		ok(w, 200, envelope{"message": "KostKita API is running"})
	})
	r.Route("/api/v1", func(v chi.Router) {
		v.Post("/auth/register", a.register)
		v.Post("/auth/login", a.login)
		v.Get("/kosts", a.listKosts)
		v.Get("/kosts/{id}", a.getPublicKost)
		v.Get("/facilities", a.listFacilities)
		v.Group(func(p chi.Router) {
			p.Use(a.auth)
			p.Get("/auth/me", a.me)
			p.Post("/auth/logout", func(w http.ResponseWriter, r *http.Request) {
				ok(w, 200, envelope{"message": "Logout client-side: discard the bearer token"})
			})
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
			p.Group(func(f chi.Router) {
				f.Use(a.role("visitor"))
				f.Get("/favorites", a.listFavorites)
				f.Post("/favorites/{kostId}", a.addFavorite)
				f.Delete("/favorites/{kostId}", a.removeFavorite)
			})
			p.Group(func(ad chi.Router) {
				ad.Use(a.role("admin"))
				ad.Get("/admin/users", a.adminUsers)
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

func (a *API) register(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Name     string `json:"name"`
		Email    string `json:"email"`
		Password string `json:"password"`
		Phone    string `json:"phone"`
		Role     string `json:"role"`
	}
	if decode(r, &in) != nil {
		fail(w, 400, "INVALID_BODY", "Invalid JSON body")
		return
	}
	in.Name = strings.TrimSpace(in.Name)
	in.Email = strings.ToLower(strings.TrimSpace(in.Email))
	in.Role = strings.TrimSpace(in.Role)
	if len(in.Name) < 2 || len(in.Name) > 100 {
		fail(w, 400, "VALIDATION_ERROR", "name must be 2–100 characters")
		return
	}
	if _, e := mail.ParseAddress(in.Email); e != nil {
		fail(w, 400, "VALIDATION_ERROR", "Valid email is required")
		return
	}
	if len(in.Password) < 8 || len(in.Password) > 72 {
		fail(w, 400, "VALIDATION_ERROR", "password must be 8–72 bytes")
		return
	}
	if in.Role != "owner" && in.Role != "visitor" {
		fail(w, 400, "VALIDATION_ERROR", "role must be owner or visitor")
		return
	}
	hash, e := bcrypt.GenerateFromPassword([]byte(in.Password), bcrypt.DefaultCost)
	if e != nil {
		fail(w, 500, "INTERNAL_ERROR", "Could not secure password")
		return
	}
	var u struct {
		ID    int64   `json:"id"`
		Name  string  `json:"name"`
		Email string  `json:"email"`
		Phone *string `json:"phone"`
		Role  string  `json:"role"`
	}
	e = a.DB.QueryRow(r.Context(), `INSERT INTO users(role_id,name,email,password_hash,phone) SELECT id,$1,$2,$3,NULLIF($4,'') FROM roles WHERE name=$5 RETURNING id,name,email,phone,$5`, in.Name, in.Email, string(hash), in.Phone, in.Role).Scan(&u.ID, &u.Name, &u.Email, &u.Phone, &u.Role)
	if e != nil {
		if strings.Contains(strings.ToLower(e.Error()), "duplicate key") {
			fail(w, 409, "EMAIL_EXISTS", "Email is already registered")
		} else {
			fail(w, 500, "DATABASE_ERROR", "Could not create account")
		}
		return
	}
	token, e := a.token(u.ID, u.Role)
	if e != nil {
		fail(w, 500, "TOKEN_ERROR", "Could not create access token")
		return
	}
	ok(w, 201, envelope{"user": u, "access_token": token, "token_type": "Bearer"})
}
func (a *API) login(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if decode(r, &in) != nil {
		fail(w, 400, "INVALID_BODY", "Invalid JSON body")
		return
	}
	var u struct {
		ID                      int64
		Name, Email, Hash, Role string
	}
	e := a.DB.QueryRow(r.Context(), `SELECT u.id,u.name,u.email,u.password_hash,ro.name FROM users u JOIN roles ro ON ro.id=u.role_id WHERE lower(u.email)=lower($1)`, strings.TrimSpace(in.Email)).Scan(&u.ID, &u.Name, &u.Email, &u.Hash, &u.Role)
	if e != nil || bcrypt.CompareHashAndPassword([]byte(u.Hash), []byte(in.Password)) != nil {
		fail(w, 401, "INVALID_CREDENTIALS", "Email or password is incorrect")
		return
	}
	token, e := a.token(u.ID, u.Role)
	if e != nil {
		fail(w, 500, "TOKEN_ERROR", "Could not create access token")
		return
	}
	ok(w, 200, envelope{"user": envelope{"id": u.ID, "name": u.Name, "email": u.Email, "role": u.Role}, "access_token": token, "token_type": "Bearer"})
}
func (a *API) me(w http.ResponseWriter, r *http.Request) {
	u := current(r)
	var id int64
	var name, email string
	var phone *string
	var created time.Time
	e := a.DB.QueryRow(r.Context(), `SELECT id,name,email,phone,created_at FROM users WHERE id=$1`, u.ID).Scan(&id, &name, &email, &phone, &created)
	if errors.Is(e, pgx.ErrNoRows) {
		fail(w, 404, "USER_NOT_FOUND", "User not found")
		return
	}
	if e != nil {
		fail(w, 500, "DATABASE_ERROR", "Could not retrieve profile")
		return
	}
	ok(w, 200, envelope{"id": id, "name": name, "email": email, "phone": phone, "role": u.Role, "created_at": created})
}

func (a *API) listKosts(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	limit := int64(12)
	offset := int64(0)
	var e error
	if q.Get("limit") != "" {
		limit, e = strconv.ParseInt(q.Get("limit"), 10, 32)
		if e != nil || limit < 1 || limit > 100 {
			fail(w, 400, "INVALID_LIMIT", "limit must be between 1 and 100")
			return
		}
	}
	if q.Get("offset") != "" {
		offset, e = strconv.ParseInt(q.Get("offset"), 10, 32)
		if e != nil || offset < 0 {
			fail(w, 400, "INVALID_OFFSET", "offset must be zero or greater")
			return
		}
	}
	city := strings.TrimSpace(q.Get("city"))
	province := strings.TrimSpace(q.Get("province"))
	keyword := strings.TrimSpace(q.Get("q"))
	minp, _ := strconv.ParseInt(q.Get("min_price"), 10, 64)
	maxp, _ := strconv.ParseInt(q.Get("max_price"), 10, 64)
	rows, e := a.DB.Query(r.Context(), `SELECT k.id,k.owner_id,k.name,k.description,k.price,k.address,k.city,k.province,k.available_rooms,k.status,k.created_at,k.updated_at FROM kosts k WHERE k.status='published' AND ($1='' OR k.city ILIKE '%'||$1||'%') AND ($2='' OR k.province ILIKE '%'||$2||'%') AND ($3='' OR (k.name||' '||k.address||' '||k.city) ILIKE '%'||$3||'%') AND ($4<=0 OR k.price >= $4) AND ($5<=0 OR k.price <= $5) ORDER BY k.created_at DESC LIMIT $6 OFFSET $7`, city, province, keyword, minp, maxp, limit, offset)
	if e != nil {
		fail(w, 500, "DATABASE_ERROR", "Could not list kosts")
		return
	}
	defer rows.Close()
	items := []envelope{}
	for rows.Next() {
		var id, owner, price int64
		var name, address, cityv, prov, status string
		var desc *string
		var rooms int32
		var created, updated time.Time
		if e = rows.Scan(&id, &owner, &name, &desc, &price, &address, &cityv, &prov, &rooms, &status, &created, &updated); e != nil {
			fail(w, 500, "DATABASE_ERROR", "Could not read kosts")
			return
		}
		items = append(items, envelope{"id": id, "owner_id": owner, "name": name, "description": desc, "price": price, "address": address, "city": cityv, "province": prov, "available_rooms": rooms, "status": status, "created_at": created, "updated_at": updated})
	}
	if rows.Err() != nil {
		fail(w, 500, "DATABASE_ERROR", "Could not read kosts")
		return
	}
	ok(w, 200, items)
}
func scanKost(row pgx.Row) (envelope, error) {
	var id, owner, price int64
	var name, address, city, province, status string
	var desc *string
	var rooms int32
	var c, u time.Time
	e := row.Scan(&id, &owner, &name, &desc, &price, &address, &city, &province, &rooms, &status, &c, &u)
	if e != nil {
		return nil, e
	}
	return envelope{"id": id, "owner_id": owner, "name": name, "description": desc, "price": price, "address": address, "city": city, "province": province, "available_rooms": rooms, "status": status, "created_at": c, "updated_at": u}, nil
}

const kostSelect = `SELECT id,owner_id,name,description,price,address,city,province,available_rooms,status,created_at,updated_at FROM kosts`

func (a *API) getPublicKost(w http.ResponseWriter, r *http.Request) {
	id, e := idParam(r)
	if e != nil {
		fail(w, 400, "INVALID_ID", "ID must be a positive integer")
		return
	}
	v, e := scanKost(a.DB.QueryRow(r.Context(), kostSelect+` WHERE id=$1 AND status='published'`, id))
	if errors.Is(e, pgx.ErrNoRows) {
		fail(w, 404, "KOST_NOT_FOUND", "Published kost was not found")
		return
	}
	if e != nil {
		fail(w, 500, "DATABASE_ERROR", "Could not retrieve kost")
		return
	}
	ok(w, 200, v)
}
func (a *API) ownerList(w http.ResponseWriter, r *http.Request) {
	u := current(r)
	rows, e := a.DB.Query(r.Context(), kostSelect+` WHERE owner_id=$1 ORDER BY created_at DESC`, u.ID)
	if e != nil {
		fail(w, 500, "DATABASE_ERROR", "Could not list your kosts")
		return
	}
	defer rows.Close()
	out := []envelope{}
	for rows.Next() {
		v, e := scanKost(rows)
		if e != nil {
			fail(w, 500, "DATABASE_ERROR", "Could not read kosts")
			return
		}
		out = append(out, v)
	}
	ok(w, 200, out)
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

func validateKost(v kostInput) string {
	if strings.TrimSpace(v.Name) == "" || len(v.Name) > 150 {
		return "name is required (max 150 characters)"
	}
	if v.Price < 0 {
		return "price must be zero or greater"
	}
	if strings.TrimSpace(v.Address) == "" || strings.TrimSpace(v.City) == "" || strings.TrimSpace(v.Province) == "" {
		return "address, city, and province are required"
	}
	if v.AvailableRooms < 0 {
		return "available_rooms must be zero or greater"
	}
	return ""
}
func (a *API) createKost(w http.ResponseWriter, r *http.Request) {
	u := current(r)
	var in kostInput
	if decode(r, &in) != nil {
		fail(w, 400, "INVALID_BODY", "Invalid JSON body")
		return
	}
	if m := validateKost(in); m != "" {
		fail(w, 400, "VALIDATION_ERROR", m)
		return
	}
	v, e := scanKost(a.DB.QueryRow(r.Context(), `INSERT INTO kosts(owner_id,name,description,price,address,city,province,available_rooms) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id,owner_id,name,description,price,address,city,province,available_rooms,status,created_at,updated_at`, u.ID, in.Name, in.Description, in.Price, in.Address, in.City, in.Province, in.AvailableRooms))
	if e != nil {
		fail(w, 500, "DATABASE_ERROR", "Could not create kost")
		return
	}
	ok(w, 201, v)
}
func (a *API) ownerGet(w http.ResponseWriter, r *http.Request) {
	u := current(r)
	id, e := idParam(r)
	if e != nil {
		fail(w, 400, "INVALID_ID", "Invalid kost ID")
		return
	}
	v, e := scanKost(a.DB.QueryRow(r.Context(), kostSelect+` WHERE id=$1 AND owner_id=$2`, id, u.ID))
	if errors.Is(e, pgx.ErrNoRows) {
		fail(w, 404, "KOST_NOT_FOUND", "Kost not found")
		return
	}
	if e != nil {
		fail(w, 500, "DATABASE_ERROR", "Could not retrieve kost")
		return
	}
	ok(w, 200, v)
}
func (a *API) updateKost(w http.ResponseWriter, r *http.Request) {
	u := current(r)
	id, e := idParam(r)
	if e != nil {
		fail(w, 400, "INVALID_ID", "Invalid kost ID")
		return
	}
	var in kostInput
	if decode(r, &in) != nil {
		fail(w, 400, "INVALID_BODY", "Invalid JSON body")
		return
	}
	if m := validateKost(in); m != "" {
		fail(w, 400, "VALIDATION_ERROR", m)
		return
	}
	v, e := scanKost(a.DB.QueryRow(r.Context(), `UPDATE kosts SET name=$3,description=$4,price=$5,address=$6,city=$7,province=$8,available_rooms=$9,updated_at=NOW() WHERE id=$1 AND owner_id=$2 RETURNING id,owner_id,name,description,price,address,city,province,available_rooms,status,created_at,updated_at`, id, u.ID, in.Name, in.Description, in.Price, in.Address, in.City, in.Province, in.AvailableRooms))
	if errors.Is(e, pgx.ErrNoRows) {
		fail(w, 404, "KOST_NOT_FOUND", "Kost not found")
		return
	}
	if e != nil {
		fail(w, 500, "DATABASE_ERROR", "Could not update kost")
		return
	}
	ok(w, 200, v)
}
func (a *API) deleteKost(w http.ResponseWriter, r *http.Request) {
	u := current(r)
	id, e := idParam(r)
	if e != nil {
		fail(w, 400, "INVALID_ID", "Invalid kost ID")
		return
	}
	tag, e := a.DB.Exec(r.Context(), `DELETE FROM kosts WHERE id=$1 AND owner_id=$2`, id, u.ID)
	if e != nil {
		fail(w, 500, "DATABASE_ERROR", "Could not delete kost")
		return
	}
	if tag.RowsAffected() == 0 {
		fail(w, 404, "KOST_NOT_FOUND", "Kost not found")
		return
	}
	ok(w, 200, envelope{"message": "Kost deleted"})
}
func (a *API) listFacilities(w http.ResponseWriter, r *http.Request) {
	rows, e := a.DB.Query(r.Context(), `SELECT id,name,created_at FROM facilities ORDER BY name`)
	if e != nil {
		fail(w, 500, "DATABASE_ERROR", "Could not list facilities")
		return
	}
	defer rows.Close()
	out := []envelope{}
	for rows.Next() {
		var id int64
		var n string
		var t time.Time
		if rows.Scan(&id, &n, &t) != nil {
			fail(w, 500, "DATABASE_ERROR", "Could not read facilities")
			return
		}
		out = append(out, envelope{"id": id, "name": n, "created_at": t})
	}
	ok(w, 200, out)
}
func (a *API) setKostFacilities(w http.ResponseWriter, r *http.Request) {
	u := current(r)
	id, e := idParam(r)
	if e != nil {
		fail(w, 400, "INVALID_ID", "Invalid kost ID")
		return
	}
	var in struct {
		FacilityIDs []int64 `json:"facility_ids"`
	}
	if decode(r, &in) != nil {
		fail(w, 400, "INVALID_BODY", "Expected facility_ids array")
		return
	}
	tx, e := a.DB.Begin(r.Context())
	if e != nil {
		fail(w, 500, "DATABASE_ERROR", "Could not start transaction")
		return
	}
	defer tx.Rollback(r.Context())
	var exists bool
	e = tx.QueryRow(r.Context(), `SELECT EXISTS(SELECT 1 FROM kosts WHERE id=$1 AND owner_id=$2)`, id, u.ID).Scan(&exists)
	if e != nil || !exists {
		fail(w, 404, "KOST_NOT_FOUND", "Kost not found")
		return
	}
	_, e = tx.Exec(r.Context(), `DELETE FROM kost_facilities WHERE kost_id=$1`, id)
	if e != nil {
		fail(w, 500, "DATABASE_ERROR", "Could not update facilities")
		return
	}
	for _, fid := range in.FacilityIDs {
		_, e = tx.Exec(r.Context(), `INSERT INTO kost_facilities(kost_id,facility_id) VALUES($1,$2)`, id, fid)
		if e != nil {
			fail(w, 400, "INVALID_FACILITY", "One or more facilities do not exist")
			return
		}
	}
	if e = tx.Commit(r.Context()); e != nil {
		fail(w, 500, "DATABASE_ERROR", "Could not save facilities")
		return
	}
	ok(w, 200, envelope{"message": "Facilities updated", "facility_ids": in.FacilityIDs})
}
func (a *API) addImage(w http.ResponseWriter, r *http.Request) {
	u := current(r)
	id, e := idParam(r)
	if e != nil {
		fail(w, 400, "INVALID_ID", "Invalid kost ID")
		return
	}
	var in struct {
		URL  string `json:"image_url"`
		Sort int32  `json:"sort_order"`
	}
	if decode(r, &in) != nil {
		fail(w, 400, "INVALID_BODY", "Invalid JSON body")
		return
	}
	parsed, e := url.ParseRequestURI(in.URL)
	if e != nil || (parsed.Scheme != "https" && parsed.Scheme != "http") || parsed.Host == "" {
		fail(w, 400, "VALIDATION_ERROR", "image_url must be a valid http or https URL")
		return
	}
	var imageID, imageKost int64
	var imageURL string
	var imageSort int32
	var imageCreated time.Time
	e = a.DB.QueryRow(r.Context(), `INSERT INTO kost_images(kost_id,image_url,sort_order) SELECT id,$2,$3 FROM kosts WHERE id=$1 AND owner_id=$4 RETURNING id,kost_id,image_url,sort_order,created_at`, id, in.URL, in.Sort, u.ID).Scan(&imageID, &imageKost, &imageURL, &imageSort, &imageCreated)
	if errors.Is(e, pgx.ErrNoRows) {
		fail(w, 404, "KOST_NOT_FOUND", "Kost not found")
		return
	}
	if e != nil {
		fail(w, 500, "DATABASE_ERROR", "Could not add image")
		return
	}
	ok(w, 201, envelope{"id": imageID, "kost_id": imageKost, "image_url": imageURL, "sort_order": imageSort, "created_at": imageCreated})
}
func (a *API) deleteImage(w http.ResponseWriter, r *http.Request) {
	u := current(r)
	id, e := idParam(r)
	if e != nil {
		fail(w, 400, "INVALID_ID", "Invalid kost ID")
		return
	}
	iid, e := strconv.ParseInt(chi.URLParam(r, "imageId"), 10, 64)
	if e != nil || iid < 1 {
		fail(w, 400, "INVALID_ID", "Invalid image ID")
		return
	}
	tag, e := a.DB.Exec(r.Context(), `DELETE FROM kost_images i USING kosts k WHERE i.id=$1 AND i.kost_id=k.id AND k.owner_id=$2 AND k.id=$3`, iid, u.ID, id)
	if e != nil {
		fail(w, 500, "DATABASE_ERROR", "Could not delete image")
		return
	}
	if tag.RowsAffected() == 0 {
		fail(w, 404, "IMAGE_NOT_FOUND", "Image not found")
		return
	}
	ok(w, 200, envelope{"message": "Image deleted"})
}
func (a *API) listFavorites(w http.ResponseWriter, r *http.Request) {
	u := current(r)
	rows, e := a.DB.Query(r.Context(), `SELECT k.id,k.owner_id,k.name,k.description,k.price,k.address,k.city,k.province,k.available_rooms,k.status,k.created_at,k.updated_at FROM favorites f JOIN kosts k ON k.id=f.kost_id WHERE f.user_id=$1 ORDER BY f.created_at DESC`, u.ID)
	if e != nil {
		fail(w, 500, "DATABASE_ERROR", "Could not list favorites")
		return
	}
	defer rows.Close()
	out := []envelope{}
	for rows.Next() {
		v, e := scanKost(rows)
		if e != nil {
			fail(w, 500, "DATABASE_ERROR", "Could not read favorites")
			return
		}
		out = append(out, v)
	}
	ok(w, 200, out)
}
func (a *API) addFavorite(w http.ResponseWriter, r *http.Request) {
	u := current(r)
	id, e := strconv.ParseInt(chi.URLParam(r, "kostId"), 10, 64)
	if e != nil || id < 1 {
		fail(w, 400, "INVALID_ID", "Invalid kost ID")
		return
	}
	tag, e := a.DB.Exec(r.Context(), `INSERT INTO favorites(user_id,kost_id) SELECT $1,id FROM kosts WHERE id=$2 AND status='published' ON CONFLICT DO NOTHING`, u.ID, id)
	if e != nil {
		fail(w, 500, "DATABASE_ERROR", "Could not add favorite")
		return
	}
	if tag.RowsAffected() == 0 {
		var exists bool
		_ = a.DB.QueryRow(r.Context(), `SELECT EXISTS(SELECT 1 FROM favorites WHERE user_id=$1 AND kost_id=$2)`, u.ID, id).Scan(&exists)
		if !exists {
			fail(w, 404, "KOST_NOT_FOUND", "Published kost not found")
			return
		}
	}
	ok(w, 201, envelope{"kost_id": id, "favorited": true})
}
func (a *API) removeFavorite(w http.ResponseWriter, r *http.Request) {
	u := current(r)
	id, e := strconv.ParseInt(chi.URLParam(r, "kostId"), 10, 64)
	if e != nil || id < 1 {
		fail(w, 400, "INVALID_ID", "Invalid kost ID")
		return
	}
	tag, e := a.DB.Exec(r.Context(), `DELETE FROM favorites WHERE user_id=$1 AND kost_id=$2`, u.ID, id)
	if e != nil {
		fail(w, 500, "DATABASE_ERROR", "Could not remove favorite")
		return
	}
	if tag.RowsAffected() == 0 {
		fail(w, 404, "FAVORITE_NOT_FOUND", "Favorite not found")
		return
	}
	ok(w, 200, envelope{"kost_id": id, "favorited": false})
}
func (a *API) adminUsers(w http.ResponseWriter, r *http.Request) {
	rows, e := a.DB.Query(r.Context(), `SELECT u.id,u.name,u.email,u.phone,ro.name,u.created_at FROM users u JOIN roles ro ON ro.id=u.role_id ORDER BY u.created_at DESC LIMIT 100`)
	if e != nil {
		fail(w, 500, "DATABASE_ERROR", "Could not list users")
		return
	}
	defer rows.Close()
	out := []envelope{}
	for rows.Next() {
		var id int64
		var n, email, role string
		var phone *string
		var t time.Time
		if rows.Scan(&id, &n, &email, &phone, &role, &t) != nil {
			fail(w, 500, "DATABASE_ERROR", "Could not read users")
			return
		}
		out = append(out, envelope{"id": id, "name": n, "email": email, "phone": phone, "role": role, "created_at": t})
	}
	ok(w, 200, out)
}
func (a *API) adminSetRole(w http.ResponseWriter, r *http.Request) {
	id, e := idParam(r)
	if e != nil {
		fail(w, 400, "INVALID_ID", "Invalid user ID")
		return
	}
	var in struct {
		Role string `json:"role"`
	}
	if decode(r, &in) != nil || (in.Role != "admin" && in.Role != "owner" && in.Role != "visitor") {
		fail(w, 400, "VALIDATION_ERROR", "role must be admin, owner, or visitor")
		return
	}
	tag, e := a.DB.Exec(r.Context(), `UPDATE users SET role_id=(SELECT id FROM roles WHERE name=$2),updated_at=NOW() WHERE id=$1`, id, in.Role)
	if e != nil {
		fail(w, 500, "DATABASE_ERROR", "Could not update role")
		return
	}
	if tag.RowsAffected() == 0 {
		fail(w, 404, "USER_NOT_FOUND", "User not found")
		return
	}
	ok(w, 200, envelope{"user_id": id, "role": in.Role})
}
func (a *API) adminSetKostStatus(w http.ResponseWriter, r *http.Request) {
	id, e := idParam(r)
	if e != nil {
		fail(w, 400, "INVALID_ID", "Invalid kost ID")
		return
	}
	var in struct {
		Status string `json:"status"`
	}
	if decode(r, &in) != nil || (in.Status != "draft" && in.Status != "published" && in.Status != "archived") {
		fail(w, 400, "VALIDATION_ERROR", "status must be draft, published, or archived")
		return
	}
	tag, e := a.DB.Exec(r.Context(), `UPDATE kosts SET status=$2,updated_at=NOW() WHERE id=$1`, id, in.Status)
	if e != nil {
		fail(w, 500, "DATABASE_ERROR", "Could not update status")
		return
	}
	if tag.RowsAffected() == 0 {
		fail(w, 404, "KOST_NOT_FOUND", "Kost not found")
		return
	}
	ok(w, 200, envelope{"kost_id": id, "status": in.Status})
}
func (a *API) adminDeleteKost(w http.ResponseWriter, r *http.Request) {
	id, e := idParam(r)
	if e != nil {
		fail(w, 400, "INVALID_ID", "Invalid kost ID")
		return
	}
	tag, e := a.DB.Exec(r.Context(), `DELETE FROM kosts WHERE id=$1`, id)
	if e != nil {
		fail(w, 500, "DATABASE_ERROR", "Could not delete kost")
		return
	}
	if tag.RowsAffected() == 0 {
		fail(w, 404, "KOST_NOT_FOUND", "Kost not found")
		return
	}
	ok(w, 200, envelope{"message": "Kost deleted"})
}
func (a *API) adminCreateFacility(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Name string `json:"name"`
	}
	if decode(r, &in) != nil || strings.TrimSpace(in.Name) == "" {
		fail(w, 400, "VALIDATION_ERROR", "facility name is required")
		return
	}
	var id int64
	var name string
	var t time.Time
	e := a.DB.QueryRow(r.Context(), `INSERT INTO facilities(name) VALUES($1) RETURNING id,name,created_at`, strings.TrimSpace(in.Name)).Scan(&id, &name, &t)
	if e != nil {
		fail(w, 409, "FACILITY_EXISTS", "Facility already exists or could not be created")
		return
	}
	ok(w, 201, envelope{"id": id, "name": name, "created_at": t})
}
func (a *API) adminDeleteFacility(w http.ResponseWriter, r *http.Request) {
	id, e := idParam(r)
	if e != nil {
		fail(w, 400, "INVALID_ID", "Invalid facility ID")
		return
	}
	tag, e := a.DB.Exec(r.Context(), `DELETE FROM facilities WHERE id=$1`, id)
	if e != nil {
		fail(w, 500, "DATABASE_ERROR", "Could not delete facility")
		return
	}
	if tag.RowsAffected() == 0 {
		fail(w, 404, "FACILITY_NOT_FOUND", "Facility not found")
		return
	}
	ok(w, 200, envelope{"message": "Facility deleted"})
}
