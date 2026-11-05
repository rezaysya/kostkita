# KostKita Backend REST API

This package extends the existing database schema with the full MVP REST surface:
- Public: health, published listing/search/filter, listing detail, facilities.
- Auth: register (owner/visitor), login (JWT bearer), current profile, logout token-discard response.
- Owner: own listing CRUD, set facilities, add/delete image URL.
- Visitor: list/add/remove favorites.
- Admin: list users, change user role, moderate listing status, delete listing, manage facilities.

## Important
1. Back up your existing `backend` directory and `.env` before replacing files.
2. Keep your existing database and demo data. Do not drop the database.
3. Apply only migration 000004:
   `migrate -path migrations -database "$DATABASE_URL" up`
   Use your actual local DATABASE_URL privately in your terminal; do not paste it into chat.
4. Copy `.env.example` to `.env`, fill DB values, and set a long random `JWT_SECRET` (32+ characters).
5. `go mod tidy`, `go test ./...`, `go run ./cmd/api`.

## Routes

| Method | Path | Access |
|---|---|---|
| GET | /health | Public |
| POST | /api/v1/auth/register | Public |
| POST | /api/v1/auth/login | Public |
| GET | /api/v1/auth/me | Authenticated |
| POST | /api/v1/auth/logout | Authenticated (client discards token) |
| GET | /api/v1/kosts | Public |
| GET | /api/v1/kosts/{id} | Public |
| GET | /api/v1/facilities | Public |
| GET/POST | /api/v1/owner/kosts | Owner |
| GET/PUT/DELETE | /api/v1/owner/kosts/{id} | Owner (ownership enforced) |
| PUT | /api/v1/owner/kosts/{id}/facilities | Owner |
| POST | /api/v1/owner/kosts/{id}/images | Owner |
| DELETE | /api/v1/owner/kosts/{id}/images/{imageId} | Owner |
| GET | /api/v1/favorites | Visitor |
| POST/DELETE | /api/v1/favorites/{kostId} | Visitor |
| GET | /api/v1/admin/users | Admin |
| PATCH | /api/v1/admin/users/{id}/role | Admin |
| PATCH/DELETE | /api/v1/admin/kosts/{id}/status | Admin |
| POST | /api/v1/admin/facilities | Admin |
| DELETE | /api/v1/admin/facilities/{id} | Admin |

For protected routes set `Authorization: Bearer <access_token>`.
Register body: `{"name":"Nama","email":"user@example.com","password":"minimal8chars","phone":"0812...","role":"owner"}`.
Only owner and visitor can self-register. Create the first admin by manually promoting a trusted account in PostgreSQL. Never expose admin role in public registration.

Kost create/update body:
`{"name":"Kost Demo","description":"Deskripsi","price":850000,"address":"Jl. Contoh 1","city":"Tangerang","province":"Banten","available_rooms":4}`.
Create starts as `draft`. Admin must publish it via PATCH `/api/v1/admin/kosts/{id}/status` with `{"status":"published"}`.
Search: `/api/v1/kosts?limit=12&offset=0&city=Tangerang&province=Banten&q=dekat&min_price=500000&max_price=1500000`.
Facility assignment body: `{"facility_ids":[1,2]}`.
Image body: `{"image_url":"https://example.com/image.webp","sort_order":0}`. This stores a URL; it does not upload image bytes.

## Security and production caveats
- JWT is stateless. Logout means client-side token removal; implement refresh-token revocation/denylist if server-side logout is required.
- First admin is provisioned manually; do not allow public admin registration.
- Image endpoint stores external URL only, not file uploads.
- Before production: add rate limiting, email verification/password reset, audit logs, stronger request validation, structured logging, CORS policy, automated tests, OpenAPI spec, and review admin role changes.
- Existing schema has no account-disabled flag. 
