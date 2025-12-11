-- Add role column to users table for RBAC
ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user';

-- Create index for role-based queries
CREATE INDEX IF NOT EXISTS users_role_idx ON users(role);
