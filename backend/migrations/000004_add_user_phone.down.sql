DROP INDEX IF EXISTS idx_kosts_status_created;
DROP INDEX IF EXISTS idx_users_role_id;
ALTER TABLE users DROP COLUMN IF EXISTS phone;
