
CREATE TABLE facilities (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE kost_facilities (
    kost_id BIGINT NOT NULL REFERENCES kosts(id) ON DELETE CASCADE,
    facility_id BIGINT NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
    PRIMARY KEY (kost_id, facility_id)
);

CREATE TABLE kost_images (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    kost_id BIGINT NOT NULL REFERENCES kosts(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_kost_images_kost_id
    ON kost_images(kost_id, sort_order);

CREATE TABLE favorites (
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kost_id BIGINT NOT NULL REFERENCES kosts(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, kost_id)
);
