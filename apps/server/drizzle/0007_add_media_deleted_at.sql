-- Add soft-delete support to media table
ALTER TABLE media ADD COLUMN deleted_at TEXT DEFAULT NULL;

-- Index for querying deleted media efficiently
CREATE INDEX IF NOT EXISTS media_deleted_at_idx ON media(deleted_at);
CREATE INDEX IF NOT EXISTS media_user_deleted_idx ON media(user_id, deleted_at);
