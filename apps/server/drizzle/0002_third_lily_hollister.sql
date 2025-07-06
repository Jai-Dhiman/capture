PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_blocked_user` (
	`id` text PRIMARY KEY NOT NULL,
	`blocker_id` text NOT NULL,
	`blocked_id` text NOT NULL,
	`created_at` numeric DEFAULT '2025-07-06T02:22:00.161Z' NOT NULL,
	FOREIGN KEY (`blocker_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`blocked_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_blocked_user`("id", "blocker_id", "blocked_id", "created_at") SELECT "id", "blocker_id", "blocked_id", "created_at" FROM `blocked_user`;--> statement-breakpoint
DROP TABLE `blocked_user`;--> statement-breakpoint
ALTER TABLE `__new_blocked_user` RENAME TO `blocked_user`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `blocker_idx` ON `blocked_user` (`blocker_id`);--> statement-breakpoint
CREATE INDEX `blocked_idx` ON `blocked_user` (`blocked_id`);--> statement-breakpoint
CREATE INDEX `block_relationship_idx` ON `blocked_user` (`blocker_id`,`blocked_id`);--> statement-breakpoint
CREATE TABLE `__new_comment` (
	`id` text PRIMARY KEY NOT NULL,
	`post_id` text NOT NULL,
	`user_id` text NOT NULL,
	`parent_id` text,
	`content` text NOT NULL,
	`path` text NOT NULL,
	`depth` integer DEFAULT 0 NOT NULL,
	`is_deleted` integer DEFAULT 0 NOT NULL,
	`created_at` numeric DEFAULT '2025-07-06T02:22:00.161Z' NOT NULL,
	`_like_count` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`post_id`) REFERENCES `post`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`parent_id`) REFERENCES `comment`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_comment`("id", "post_id", "user_id", "parent_id", "content", "path", "depth", "is_deleted", "created_at", "_like_count") SELECT "id", "post_id", "user_id", "parent_id", "content", "path", "depth", "is_deleted", "created_at", "_like_count" FROM `comment`;--> statement-breakpoint
DROP TABLE `comment`;--> statement-breakpoint
ALTER TABLE `__new_comment` RENAME TO `comment`;--> statement-breakpoint
CREATE INDEX `post_comments_idx` ON `comment` (`post_id`);--> statement-breakpoint
CREATE INDEX `user_comments_idx` ON `comment` (`user_id`);--> statement-breakpoint
CREATE INDEX `comment_path_idx` ON `comment` (`path`);--> statement-breakpoint
CREATE INDEX `comment_parent_idx` ON `comment` (`parent_id`);--> statement-breakpoint
CREATE INDEX `comment_threading_idx` ON `comment` (`post_id`,`parent_id`,`depth`,`created_at`);--> statement-breakpoint
CREATE INDEX `comment_popularity_idx` ON `comment` (`post_id`,`_like_count`,`created_at`);--> statement-breakpoint
CREATE TABLE `__new_comment_like` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`comment_id` text NOT NULL,
	`created_at` numeric DEFAULT '2025-07-06T02:22:00.161Z' NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`comment_id`) REFERENCES `comment`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_comment_like`("id", "user_id", "comment_id", "created_at") SELECT "id", "user_id", "comment_id", "created_at" FROM `comment_like`;--> statement-breakpoint
DROP TABLE `comment_like`;--> statement-breakpoint
ALTER TABLE `__new_comment_like` RENAME TO `comment_like`;--> statement-breakpoint
CREATE INDEX `user_comment_likes_idx` ON `comment_like` (`user_id`);--> statement-breakpoint
CREATE INDEX `comment_likes_idx` ON `comment_like` (`comment_id`);--> statement-breakpoint
CREATE INDEX `comment_like_composite_idx` ON `comment_like` (`user_id`,`comment_id`);--> statement-breakpoint
CREATE TABLE `__new_draft_post` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`content` text NOT NULL,
	`type` text DEFAULT 'post' NOT NULL,
	`editing_metadata` text,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` numeric DEFAULT '2025-07-06T02:22:00.160Z' NOT NULL,
	`updated_at` numeric DEFAULT '2025-07-06T02:22:00.160Z' NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_draft_post`("id", "user_id", "content", "type", "editing_metadata", "version", "created_at", "updated_at") SELECT "id", "user_id", "content", "type", "editing_metadata", "version", "created_at", "updated_at" FROM `draft_post`;--> statement-breakpoint
DROP TABLE `draft_post`;--> statement-breakpoint
ALTER TABLE `__new_draft_post` RENAME TO `draft_post`;--> statement-breakpoint
CREATE INDEX `user_drafts_idx` ON `draft_post` (`user_id`);--> statement-breakpoint
CREATE INDEX `draft_time_idx` ON `draft_post` (`updated_at`);--> statement-breakpoint
CREATE TABLE `__new_draft_post_hashtag` (
	`draft_post_id` text NOT NULL,
	`hashtag_id` text NOT NULL,
	`created_at` numeric DEFAULT '2025-07-06T02:22:00.160Z' NOT NULL,
	FOREIGN KEY (`draft_post_id`) REFERENCES `draft_post`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`hashtag_id`) REFERENCES `hashtag`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_draft_post_hashtag`("draft_post_id", "hashtag_id", "created_at") SELECT "draft_post_id", "hashtag_id", "created_at" FROM `draft_post_hashtag`;--> statement-breakpoint
DROP TABLE `draft_post_hashtag`;--> statement-breakpoint
ALTER TABLE `__new_draft_post_hashtag` RENAME TO `draft_post_hashtag`;--> statement-breakpoint
CREATE INDEX `draft_post_hashtag_idx` ON `draft_post_hashtag` (`draft_post_id`);--> statement-breakpoint
CREATE INDEX `draft_hashtag_post_idx` ON `draft_post_hashtag` (`hashtag_id`);--> statement-breakpoint
CREATE TABLE `__new_email_codes` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`code` text NOT NULL,
	`type` text NOT NULL,
	`expires_at` numeric NOT NULL,
	`created_at` numeric DEFAULT '2025-07-06T02:22:00.160Z' NOT NULL,
	`used_at` numeric
);
--> statement-breakpoint
INSERT INTO `__new_email_codes`("id", "email", "code", "type", "expires_at", "created_at", "used_at") SELECT "id", "email", "code", "type", "expires_at", "created_at", "used_at" FROM `email_codes`;--> statement-breakpoint
DROP TABLE `email_codes`;--> statement-breakpoint
ALTER TABLE `__new_email_codes` RENAME TO `email_codes`;--> statement-breakpoint
CREATE INDEX `email_codes_email_idx` ON `email_codes` (`email`);--> statement-breakpoint
CREATE INDEX `email_codes_expires_idx` ON `email_codes` (`expires_at`);--> statement-breakpoint
CREATE INDEX `email_codes_code_idx` ON `email_codes` (`code`);--> statement-breakpoint
CREATE TABLE `__new_hashtag` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`created_at` numeric DEFAULT '2025-07-06T02:22:00.161Z' NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_hashtag`("id", "name", "created_at") SELECT "id", "name", "created_at" FROM `hashtag`;--> statement-breakpoint
DROP TABLE `hashtag`;--> statement-breakpoint
ALTER TABLE `__new_hashtag` RENAME TO `hashtag`;--> statement-breakpoint
CREATE UNIQUE INDEX `hashtag_name_unique` ON `hashtag` (`name`);--> statement-breakpoint
CREATE INDEX `hashtag_name_idx` ON `hashtag` (`name`);--> statement-breakpoint
CREATE TABLE `__new_media` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`post_id` text,
	`draft_post_id` text,
	`type` text NOT NULL,
	`storage_key` text NOT NULL,
	`order` integer NOT NULL,
	`created_at` numeric DEFAULT '2025-07-06T02:22:00.161Z' NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`post_id`) REFERENCES `post`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`draft_post_id`) REFERENCES `draft_post`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_media`("id", "user_id", "post_id", "draft_post_id", "type", "storage_key", "order", "created_at") SELECT "id", "user_id", "post_id", "draft_post_id", "type", "storage_key", "order", "created_at" FROM `media`;--> statement-breakpoint
DROP TABLE `media`;--> statement-breakpoint
ALTER TABLE `__new_media` RENAME TO `media`;--> statement-breakpoint
CREATE INDEX `post_media_idx` ON `media` (`post_id`);--> statement-breakpoint
CREATE INDEX `draft_media_idx` ON `media` (`draft_post_id`);--> statement-breakpoint
CREATE INDEX `user_media_idx` ON `media` (`user_id`);--> statement-breakpoint
CREATE TABLE `__new_notification` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`type` text NOT NULL,
	`action_user_id` text,
	`resource_id` text,
	`resource_type` text,
	`message` text NOT NULL,
	`is_read` integer DEFAULT 0 NOT NULL,
	`created_at` numeric DEFAULT '2025-07-06T02:22:00.161Z' NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`action_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_notification`("id", "user_id", "type", "action_user_id", "resource_id", "resource_type", "message", "is_read", "created_at") SELECT "id", "user_id", "type", "action_user_id", "resource_id", "resource_type", "message", "is_read", "created_at" FROM `notification`;--> statement-breakpoint
DROP TABLE `notification`;--> statement-breakpoint
ALTER TABLE `__new_notification` RENAME TO `notification`;--> statement-breakpoint
CREATE INDEX `user_notifications_idx` ON `notification` (`user_id`);--> statement-breakpoint
CREATE INDEX `notification_time_idx` ON `notification` (`created_at`);--> statement-breakpoint
CREATE INDEX `notification_read_idx` ON `notification` (`is_read`);--> statement-breakpoint
CREATE INDEX `notification_user_read_time_idx` ON `notification` (`user_id`,`is_read`,`created_at`);--> statement-breakpoint
CREATE INDEX `notification_user_type_idx` ON `notification` (`user_id`,`type`,`created_at`);--> statement-breakpoint
CREATE TABLE `__new_notification_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`enable_in_app` integer DEFAULT 1 NOT NULL,
	`enable_push` integer DEFAULT 1 NOT NULL,
	`frequency` text DEFAULT 'IMMEDIATE' NOT NULL,
	`created_at` numeric DEFAULT '2025-07-06T02:22:00.162Z' NOT NULL,
	`updated_at` numeric DEFAULT '2025-07-06T02:22:00.162Z' NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_notification_settings`("id", "user_id", "enable_in_app", "enable_push", "frequency", "created_at", "updated_at") SELECT "id", "user_id", "enable_in_app", "enable_push", "frequency", "created_at", "updated_at" FROM `notification_settings`;--> statement-breakpoint
DROP TABLE `notification_settings`;--> statement-breakpoint
ALTER TABLE `__new_notification_settings` RENAME TO `notification_settings`;--> statement-breakpoint
CREATE UNIQUE INDEX `notification_settings_user_id_unique` ON `notification_settings` (`user_id`);--> statement-breakpoint
CREATE TABLE `__new_passkeys` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`credential_id` text NOT NULL,
	`public_key` text NOT NULL,
	`counter` integer DEFAULT 0 NOT NULL,
	`device_name` text,
	`created_at` numeric DEFAULT '2025-07-06T02:22:00.160Z' NOT NULL,
	`last_used_at` numeric,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_passkeys`("id", "user_id", "credential_id", "public_key", "counter", "device_name", "created_at", "last_used_at") SELECT "id", "user_id", "credential_id", "public_key", "counter", "device_name", "created_at", "last_used_at" FROM `passkeys`;--> statement-breakpoint
DROP TABLE `passkeys`;--> statement-breakpoint
ALTER TABLE `__new_passkeys` RENAME TO `passkeys`;--> statement-breakpoint
CREATE UNIQUE INDEX `passkeys_credential_id_unique` ON `passkeys` (`credential_id`);--> statement-breakpoint
CREATE INDEX `passkeys_user_idx` ON `passkeys` (`user_id`);--> statement-breakpoint
CREATE INDEX `passkeys_credential_idx` ON `passkeys` (`credential_id`);--> statement-breakpoint
CREATE TABLE `__new_post` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`content` text NOT NULL,
	`type` text DEFAULT 'post' NOT NULL,
	`is_draft` integer DEFAULT 0 NOT NULL,
	`editing_metadata` text,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` numeric DEFAULT '2025-07-06T02:22:00.160Z' NOT NULL,
	`updated_at` numeric DEFAULT '2025-07-06T02:22:00.160Z' NOT NULL,
	`_save_count` integer DEFAULT 0 NOT NULL,
	`_comment_count` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_post`("id", "user_id", "content", "type", "is_draft", "editing_metadata", "version", "created_at", "updated_at", "_save_count", "_comment_count") SELECT "id", "user_id", "content", "type", "is_draft", "editing_metadata", "version", "created_at", "updated_at", "_save_count", "_comment_count" FROM `post`;--> statement-breakpoint
DROP TABLE `post`;--> statement-breakpoint
ALTER TABLE `__new_post` RENAME TO `post`;--> statement-breakpoint
CREATE INDEX `user_posts_idx` ON `post` (`user_id`);--> statement-breakpoint
CREATE INDEX `post_time_idx` ON `post` (`created_at`);--> statement-breakpoint
CREATE INDEX `post_discovery_idx` ON `post` (`is_draft`,`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `post_popularity_idx` ON `post` (`_save_count`,`_comment_count`,`created_at`);--> statement-breakpoint
CREATE INDEX `user_posts_time_idx` ON `post` (`user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `__new_post_hashtag` (
	`post_id` text NOT NULL,
	`hashtag_id` text NOT NULL,
	`created_at` numeric DEFAULT '2025-07-06T02:22:00.161Z' NOT NULL,
	FOREIGN KEY (`post_id`) REFERENCES `post`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`hashtag_id`) REFERENCES `hashtag`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_post_hashtag`("post_id", "hashtag_id", "created_at") SELECT "post_id", "hashtag_id", "created_at" FROM `post_hashtag`;--> statement-breakpoint
DROP TABLE `post_hashtag`;--> statement-breakpoint
ALTER TABLE `__new_post_hashtag` RENAME TO `post_hashtag`;--> statement-breakpoint
CREATE INDEX `post_hashtag_idx` ON `post_hashtag` (`post_id`);--> statement-breakpoint
CREATE INDEX `hashtag_post_idx` ON `post_hashtag` (`hashtag_id`);--> statement-breakpoint
CREATE INDEX `post_hashtag_composite_idx` ON `post_hashtag` (`post_id`,`hashtag_id`);--> statement-breakpoint
CREATE TABLE `__new_post_like` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`post_id` text NOT NULL,
	`created_at` numeric DEFAULT '2025-07-06T02:22:00.161Z' NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`post_id`) REFERENCES `post`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_post_like`("id", "user_id", "post_id", "created_at") SELECT "id", "user_id", "post_id", "created_at" FROM `post_like`;--> statement-breakpoint
DROP TABLE `post_like`;--> statement-breakpoint
ALTER TABLE `__new_post_like` RENAME TO `post_like`;--> statement-breakpoint
CREATE INDEX `user_post_likes_idx` ON `post_like` (`user_id`);--> statement-breakpoint
CREATE INDEX `post_likes_idx` ON `post_like` (`post_id`);--> statement-breakpoint
CREATE INDEX `post_like_composite_idx` ON `post_like` (`user_id`,`post_id`);--> statement-breakpoint
CREATE TABLE `__new_post_version_history` (
	`id` text PRIMARY KEY NOT NULL,
	`post_id` text NOT NULL,
	`draft_post_id` text,
	`version` integer NOT NULL,
	`content` text NOT NULL,
	`editing_metadata` text,
	`change_type` text NOT NULL,
	`change_description` text,
	`user_id` text NOT NULL,
	`created_at` numeric DEFAULT '2025-07-06T02:22:00.161Z' NOT NULL,
	FOREIGN KEY (`post_id`) REFERENCES `post`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`draft_post_id`) REFERENCES `draft_post`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_post_version_history`("id", "post_id", "draft_post_id", "version", "content", "editing_metadata", "change_type", "change_description", "user_id", "created_at") SELECT "id", "post_id", "draft_post_id", "version", "content", "editing_metadata", "change_type", "change_description", "user_id", "created_at" FROM `post_version_history`;--> statement-breakpoint
DROP TABLE `post_version_history`;--> statement-breakpoint
ALTER TABLE `__new_post_version_history` RENAME TO `post_version_history`;--> statement-breakpoint
CREATE INDEX `post_version_history_post_idx` ON `post_version_history` (`post_id`);--> statement-breakpoint
CREATE INDEX `post_version_history_draft_idx` ON `post_version_history` (`draft_post_id`);--> statement-breakpoint
CREATE INDEX `post_version_history_user_idx` ON `post_version_history` (`user_id`);--> statement-breakpoint
CREATE INDEX `post_version_history_time_idx` ON `post_version_history` (`created_at`);--> statement-breakpoint
CREATE TABLE `__new_profile` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`username` text NOT NULL,
	`profile_image` text,
	`bio` text,
	`verified_type` text DEFAULT 'none',
	`is_private` integer DEFAULT 0 NOT NULL,
	`created_at` numeric DEFAULT '2025-07-06T02:22:00.159Z' NOT NULL,
	`updated_at` numeric DEFAULT '2025-07-06T02:22:00.159Z' NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_profile`("id", "user_id", "username", "profile_image", "bio", "verified_type", "is_private", "created_at", "updated_at") SELECT "id", "user_id", "username", "profile_image", "bio", "verified_type", "is_private", "created_at", "updated_at" FROM `profile`;--> statement-breakpoint
DROP TABLE `profile`;--> statement-breakpoint
ALTER TABLE `__new_profile` RENAME TO `profile`;--> statement-breakpoint
CREATE UNIQUE INDEX `profile_user_id_unique` ON `profile` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `profile_username_unique` ON `profile` (`username`);--> statement-breakpoint
CREATE INDEX `profile_privacy_idx` ON `profile` (`is_private`,`user_id`);--> statement-breakpoint
CREATE INDEX `profile_username_search_idx` ON `profile` (`username`);--> statement-breakpoint
CREATE TABLE `__new_relationship` (
	`id` text PRIMARY KEY NOT NULL,
	`follower_id` text NOT NULL,
	`followed_id` text NOT NULL,
	`created_at` numeric DEFAULT '2025-07-06T02:22:00.161Z' NOT NULL,
	FOREIGN KEY (`follower_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`followed_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_relationship`("id", "follower_id", "followed_id", "created_at") SELECT "id", "follower_id", "followed_id", "created_at" FROM `relationship`;--> statement-breakpoint
DROP TABLE `relationship`;--> statement-breakpoint
ALTER TABLE `__new_relationship` RENAME TO `relationship`;--> statement-breakpoint
CREATE INDEX `follower_idx` ON `relationship` (`follower_id`);--> statement-breakpoint
CREATE INDEX `followed_idx` ON `relationship` (`followed_id`);--> statement-breakpoint
CREATE INDEX `relationship_composite_idx` ON `relationship` (`follower_id`,`followed_id`);--> statement-breakpoint
CREATE TABLE `__new_saved_posts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`post_id` text NOT NULL,
	`created_at` numeric DEFAULT '2025-07-06T02:22:00.161Z' NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`post_id`) REFERENCES `post`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_saved_posts`("id", "user_id", "post_id", "created_at") SELECT "id", "user_id", "post_id", "created_at" FROM `saved_posts`;--> statement-breakpoint
DROP TABLE `saved_posts`;--> statement-breakpoint
ALTER TABLE `__new_saved_posts` RENAME TO `saved_posts`;--> statement-breakpoint
CREATE INDEX `user_saved_idx` ON `saved_posts` (`user_id`);--> statement-breakpoint
CREATE INDEX `post_saved_idx` ON `saved_posts` (`post_id`);--> statement-breakpoint
CREATE TABLE `__new_seen_post_log` (
	`user_id` text NOT NULL,
	`post_id` text NOT NULL,
	`seen_at` numeric DEFAULT '2025-07-06T02:22:00.161Z' NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`post_id`) REFERENCES `post`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_seen_post_log`("user_id", "post_id", "seen_at") SELECT "user_id", "post_id", "seen_at" FROM `seen_post_log`;--> statement-breakpoint
DROP TABLE `seen_post_log`;--> statement-breakpoint
ALTER TABLE `__new_seen_post_log` RENAME TO `seen_post_log`;--> statement-breakpoint
CREATE INDEX `seen_post_user_id_idx` ON `seen_post_log` (`user_id`);--> statement-breakpoint
CREATE INDEX `seen_post_seen_at_idx` ON `seen_post_log` (`seen_at`);--> statement-breakpoint
CREATE INDEX `seen_post_composite_idx` ON `seen_post_log` (`user_id`,`post_id`);--> statement-breakpoint
CREATE INDEX `seen_post_user_time_idx` ON `seen_post_log` (`user_id`,`seen_at`);--> statement-breakpoint
CREATE TABLE `__new_user_activity` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`event_type` text NOT NULL,
	`created_at` numeric DEFAULT '2025-07-06T02:22:00.162Z' NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_user_activity`("id", "user_id", "event_type", "created_at") SELECT "id", "user_id", "event_type", "created_at" FROM `user_activity`;--> statement-breakpoint
DROP TABLE `user_activity`;--> statement-breakpoint
ALTER TABLE `__new_user_activity` RENAME TO `user_activity`;--> statement-breakpoint
CREATE INDEX `user_activity_user_idx` ON `user_activity` (`user_id`);--> statement-breakpoint
CREATE INDEX `user_activity_time_idx` ON `user_activity` (`created_at`);--> statement-breakpoint
CREATE TABLE `__new_users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`email_verified` integer DEFAULT 0 NOT NULL,
	`phone` text,
	`phone_verified` integer DEFAULT 0 NOT NULL,
	`apple_id` text,
	`created_at` numeric DEFAULT '2025-07-06T02:22:00.157Z' NOT NULL,
	`updated_at` numeric DEFAULT '2025-07-06T02:22:00.158Z' NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_users`("id", "email", "email_verified", "phone", "phone_verified", "apple_id", "created_at", "updated_at") SELECT "id", "email", "email_verified", "phone", "phone_verified", "apple_id", "created_at", "updated_at" FROM `users`;--> statement-breakpoint
DROP TABLE `users`;--> statement-breakpoint
ALTER TABLE `__new_users` RENAME TO `users`;--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_apple_id_unique` ON `users` (`apple_id`);