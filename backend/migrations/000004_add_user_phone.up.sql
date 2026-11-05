ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(30);
CREATE INDEX IF NOT EXISTS idx_users_role_id ON users(role_id);
CREATE INDEX IF NOT EXISTS idx_kosts_status_created ON kosts(status, created_at DESC);
