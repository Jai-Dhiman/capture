-- Push Notification Device Tokens table
CREATE TABLE IF NOT EXISTS device_token (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id),
  token TEXT NOT NULL,
  platform TEXT NOT NULL,
  device_name TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Indexes for device_token table
CREATE INDEX IF NOT EXISTS device_token_user_idx ON device_token(user_id);
CREATE INDEX IF NOT EXISTS device_token_token_idx ON device_token(token);
CREATE INDEX IF NOT EXISTS device_token_active_idx ON device_token(user_id, is_active);
