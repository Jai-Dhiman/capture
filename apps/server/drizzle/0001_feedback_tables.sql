-- Simple feedback tables without foreign key constraints initially
PRAGMA foreign_keys=OFF;

-- Create feedback category table
CREATE TABLE IF NOT EXISTS `feedback_category` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL UNIQUE,
	`description` text,
	`is_active` integer DEFAULT 1 NOT NULL,
	`priority_level` integer DEFAULT 1 NOT NULL,
	`created_at` numeric DEFAULT (datetime('now')) NOT NULL
);

-- Create feedback ticket table  
CREATE TABLE IF NOT EXISTS `feedback_ticket` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`category_id` text NOT NULL,
	`subject` text NOT NULL,
	`description` text NOT NULL,
	`priority` text DEFAULT 'medium' NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`type` text DEFAULT 'feedback' NOT NULL,
	`app_version` text,
	`device_info` text,
	`created_at` numeric DEFAULT (datetime('now')) NOT NULL,
	`updated_at` numeric DEFAULT (datetime('now')) NOT NULL,
	`resolved_at` numeric,
	`assigned_admin_id` text
);

-- Create feedback response table
CREATE TABLE IF NOT EXISTS `feedback_response` (
	`id` text PRIMARY KEY NOT NULL,
	`ticket_id` text NOT NULL,
	`responder_id` text NOT NULL,
	`responder_type` text DEFAULT 'user' NOT NULL,
	`message` text NOT NULL,
	`is_internal` integer DEFAULT 0 NOT NULL,
	`created_at` numeric DEFAULT (datetime('now')) NOT NULL
);

-- Create feedback attachment table
CREATE TABLE IF NOT EXISTS `feedback_attachment` (
	`id` text PRIMARY KEY NOT NULL,
	`ticket_id` text NOT NULL,
	`media_id` text NOT NULL,
	`uploaded_by` text NOT NULL,
	`description` text,
	`created_at` numeric DEFAULT (datetime('now')) NOT NULL
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS `feedback_category_name_idx` ON `feedback_category` (`name`);
CREATE INDEX IF NOT EXISTS `feedback_category_active_idx` ON `feedback_category` (`is_active`);
CREATE INDEX IF NOT EXISTS `feedback_category_priority_idx` ON `feedback_category` (`priority_level`);

CREATE INDEX IF NOT EXISTS `feedback_user_idx` ON `feedback_ticket` (`user_id`);
CREATE INDEX IF NOT EXISTS `feedback_status_idx` ON `feedback_ticket` (`status`);
CREATE INDEX IF NOT EXISTS `feedback_category_idx` ON `feedback_ticket` (`category_id`);
CREATE INDEX IF NOT EXISTS `feedback_priority_idx` ON `feedback_ticket` (`priority`);
CREATE INDEX IF NOT EXISTS `feedback_created_idx` ON `feedback_ticket` (`created_at`);
CREATE INDEX IF NOT EXISTS `feedback_user_status_idx` ON `feedback_ticket` (`user_id`, `status`, `created_at`);
CREATE INDEX IF NOT EXISTS `feedback_admin_queue_idx` ON `feedback_ticket` (`status`, `priority`, `created_at`);
CREATE INDEX IF NOT EXISTS `feedback_type_idx` ON `feedback_ticket` (`type`);

CREATE INDEX IF NOT EXISTS `response_ticket_idx` ON `feedback_response` (`ticket_id`);
CREATE INDEX IF NOT EXISTS `response_time_idx` ON `feedback_response` (`created_at`);
CREATE INDEX IF NOT EXISTS `response_responder_idx` ON `feedback_response` (`responder_id`);
CREATE INDEX IF NOT EXISTS `response_thread_idx` ON `feedback_response` (`ticket_id`, `is_internal`, `created_at`);

CREATE INDEX IF NOT EXISTS `attachment_ticket_idx` ON `feedback_attachment` (`ticket_id`);
CREATE INDEX IF NOT EXISTS `attachment_media_idx` ON `feedback_attachment` (`media_id`);
CREATE INDEX IF NOT EXISTS `attachment_uploader_idx` ON `feedback_attachment` (`uploaded_by`);

PRAGMA foreign_keys=ON;