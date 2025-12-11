-- Add granular notification settings columns
ALTER TABLE notification_settings ADD COLUMN likes INTEGER DEFAULT 1 NOT NULL;
ALTER TABLE notification_settings ADD COLUMN comments INTEGER DEFAULT 1 NOT NULL;
ALTER TABLE notification_settings ADD COLUMN follows INTEGER DEFAULT 1 NOT NULL;
ALTER TABLE notification_settings ADD COLUMN mentions INTEGER DEFAULT 1 NOT NULL;
ALTER TABLE notification_settings ADD COLUMN saves INTEGER DEFAULT 0 NOT NULL;
