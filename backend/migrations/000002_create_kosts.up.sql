
CREATE TABLE kosts (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    owner_id BIGINT NOT NULL REFERENCES users(id),
    name VARCHAR(150) NOT NULL,
    description TEXT,
    price BIGINT NOT NULL CHECK (price >= 0),
    address TEXT NOT NULL,
    city VARCHAR(100) NOT NULL,
    province VARCHAR(100) NOT NULL,
    available_rooms INTEGER NOT NULL DEFAULT 0
        CHECK (available_rooms >= 0),
    status VARCHAR(20) NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'published', 'archived')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_kosts_owner_id
    ON kosts(owner_id);

CREATE INDEX idx_kosts_published_city_price
    ON kosts(city, price)
    WHERE status = 'published';
