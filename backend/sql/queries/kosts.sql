
-- name: ListPublishedKosts :many
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
WHERE status = 'published'
ORDER BY created_at DESC
LIMIT $1
OFFSET $2;


-- name: GetPublishedKostByID :one
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
WHERE id = $1
  AND status = 'published'
LIMIT 1;