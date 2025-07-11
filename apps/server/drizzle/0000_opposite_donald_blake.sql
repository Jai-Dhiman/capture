DROP TABLE IF EXISTS `blocked_user`;
DROP TABLE IF EXISTS `comment_like`;
DROP TABLE IF EXISTS `comment`;
DROP TABLE IF EXISTS `draft_post_hashtag`;
DROP TABLE IF EXISTS `media`;
DROP TABLE IF EXISTS `notification`;
DROP TABLE IF EXISTS `notification_settings`;
DROP TABLE IF EXISTS `passkeys`;
DROP TABLE IF EXISTS `post_hashtag`;
DROP TABLE IF EXISTS `post_like`;
DROP TABLE IF EXISTS `post_version_history`;
DROP TABLE IF EXISTS `profile`;
DROP TABLE IF EXISTS `relationship`;
DROP TABLE IF EXISTS `saved_posts`;
DROP TABLE IF EXISTS `seen_post_log`;
DROP TABLE IF EXISTS `user_activity`;
DROP TABLE IF EXISTS `draft_post`;
DROP TABLE IF EXISTS `post`;
DROP TABLE IF EXISTS `hashtag`;
DROP TABLE IF EXISTS `email_codes`;
DROP TABLE IF EXISTS `users`;

CREATE TABLE `blocked_user` (
	`id` text PRIMARY KEY NOT NULL,
	`blocker_id` text NOT NULL,
	`blocked_id` text NOT NULL,
	`created_at` numeric DEFAULT '2025-07-07T04:36:01.069Z' NOT NULL,
	FOREIGN KEY (`blocker_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`blocked_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `blocker_idx` ON `blocked_user` (`blocker_id`);--> statement-breakpoint
CREATE INDEX `blocked_idx` ON `blocked_user` (`blocked_id`);--> statement-breakpoint
CREATE INDEX `block_relationship_idx` ON `blocked_user` (`blocker_id`,`blocked_id`);--> statement-breakpoint
CREATE TABLE `comment` (
	`id` text PRIMARY KEY NOT NULL,
	`post_id` text NOT NULL,
	`user_id` text NOT NULL,
	`parent_id` text,
	`content` text NOT NULL,
	`path` text NOT NULL,
	`depth` integer DEFAULT 0 NOT NULL,
	`is_deleted` integer DEFAULT 0 NOT NULL,
	`created_at` numeric DEFAULT '2025-07-07T04:36:01.068Z' NOT NULL,
	`_like_count` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`post_id`) REFERENCES `post`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`parent_id`) REFERENCES `comment`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `post_comments_idx` ON `comment` (`post_id`);--> statement-breakpoint
CREATE INDEX `user_comments_idx` ON `comment` (`user_id`);--> statement-breakpoint
CREATE INDEX `comment_path_idx` ON `comment` (`path`);--> statement-breakpoint
CREATE INDEX `comment_parent_idx` ON `comment` (`parent_id`);--> statement-breakpoint
CREATE INDEX `comment_threading_idx` ON `comment` (`post_id`,`parent_id`,`depth`,`created_at`);--> statement-breakpoint
CREATE INDEX `comment_popularity_idx` ON `comment` (`post_id`,`_like_count`,`created_at`);--> statement-breakpoint
CREATE TABLE `comment_like` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`comment_id` text NOT NULL,
	`created_at` numeric DEFAULT '2025-07-07T04:36:01.069Z' NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`comment_id`) REFERENCES `comment`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `user_comment_likes_idx` ON `comment_like` (`user_id`);--> statement-breakpoint
CREATE INDEX `comment_likes_idx` ON `comment_like` (`comment_id`);--> statement-breakpoint
CREATE INDEX `comment_like_composite_idx` ON `comment_like` (`user_id`,`comment_id`);--> statement-breakpoint
CREATE TABLE `draft_post` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`content` text NOT NULL,
	`type` text DEFAULT 'post' NOT NULL,
	`editing_metadata` text,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` numeric DEFAULT '2025-07-07T04:36:01.068Z' NOT NULL,
	`updated_at` numeric DEFAULT '2025-07-07T04:36:01.068Z' NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `user_drafts_idx` ON `draft_post` (`user_id`);--> statement-breakpoint
CREATE INDEX `draft_time_idx` ON `draft_post` (`updated_at`);--> statement-breakpoint
CREATE TABLE `draft_post_hashtag` (
	`draft_post_id` text NOT NULL,
	`hashtag_id` text NOT NULL,
	`created_at` numeric DEFAULT '2025-07-07T04:36:01.068Z' NOT NULL,
	FOREIGN KEY (`draft_post_id`) REFERENCES `draft_post`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`hashtag_id`) REFERENCES `hashtag`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `draft_post_hashtag_idx` ON `draft_post_hashtag` (`draft_post_id`);--> statement-breakpoint
CREATE INDEX `draft_hashtag_post_idx` ON `draft_post_hashtag` (`hashtag_id`);--> statement-breakpoint
CREATE TABLE `email_codes` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`code` text NOT NULL,
	`type` text NOT NULL,
	`expires_at` numeric NOT NULL,
	`created_at` numeric DEFAULT '2025-07-07T04:36:01.067Z' NOT NULL,
	`used_at` numeric
);
--> statement-breakpoint
CREATE INDEX `email_codes_email_idx` ON `email_codes` (`email`);--> statement-breakpoint
CREATE INDEX `email_codes_expires_idx` ON `email_codes` (`expires_at`);--> statement-breakpoint
CREATE INDEX `email_codes_code_idx` ON `email_codes` (`code`);--> statement-breakpoint
CREATE TABLE `hashtag` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`created_at` numeric DEFAULT '2025-07-07T04:36:01.068Z' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `hashtag_name_unique` ON `hashtag` (`name`);--> statement-breakpoint
CREATE INDEX `hashtag_name_idx` ON `hashtag` (`name`);--> statement-breakpoint
CREATE TABLE `media` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`post_id` text,
	`draft_post_id` text,
	`type` text NOT NULL,
	`storage_key` text NOT NULL,
	`order` integer NOT NULL,
	`created_at` numeric DEFAULT '2025-07-07T04:36:01.068Z' NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`post_id`) REFERENCES `post`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`draft_post_id`) REFERENCES `draft_post`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `post_media_idx` ON `media` (`post_id`);--> statement-breakpoint
CREATE INDEX `draft_media_idx` ON `media` (`draft_post_id`);--> statement-breakpoint
CREATE INDEX `user_media_idx` ON `media` (`user_id`);--> statement-breakpoint
CREATE TABLE `notification` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`type` text NOT NULL,
	`action_user_id` text,
	`resource_id` text,
	`resource_type` text,
	`message` text NOT NULL,
	`is_read` integer DEFAULT 0 NOT NULL,
	`created_at` numeric DEFAULT '2025-07-07T04:36:01.069Z' NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`action_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `user_notifications_idx` ON `notification` (`user_id`);--> statement-breakpoint
CREATE INDEX `notification_time_idx` ON `notification` (`created_at`);--> statement-breakpoint
CREATE INDEX `notification_read_idx` ON `notification` (`is_read`);--> statement-breakpoint
CREATE INDEX `notification_user_read_time_idx` ON `notification` (`user_id`,`is_read`,`created_at`);--> statement-breakpoint
CREATE INDEX `notification_user_type_idx` ON `notification` (`user_id`,`type`,`created_at`);--> statement-breakpoint
CREATE TABLE `notification_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`enable_in_app` integer DEFAULT 1 NOT NULL,
	`enable_push` integer DEFAULT 1 NOT NULL,
	`frequency` text DEFAULT 'IMMEDIATE' NOT NULL,
	`created_at` numeric DEFAULT '2025-07-07T04:36:01.069Z' NOT NULL,
	`updated_at` numeric DEFAULT '2025-07-07T04:36:01.069Z' NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `notification_settings_user_id_unique` ON `notification_settings` (`user_id`);--> statement-breakpoint
CREATE TABLE `passkeys` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`credential_id` text NOT NULL,
	`public_key` text NOT NULL,
	`counter` integer DEFAULT 0 NOT NULL,
	`device_name` text,
	`created_at` numeric DEFAULT '2025-07-07T04:36:01.067Z' NOT NULL,
	`last_used_at` numeric,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `passkeys_credential_id_unique` ON `passkeys` (`credential_id`);--> statement-breakpoint
CREATE INDEX `passkeys_user_idx` ON `passkeys` (`user_id`);--> statement-breakpoint
CREATE INDEX `passkeys_credential_idx` ON `passkeys` (`credential_id`);--> statement-breakpoint
CREATE TABLE `post` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`content` text NOT NULL,
	`type` text DEFAULT 'post' NOT NULL,
	`is_draft` integer DEFAULT 0 NOT NULL,
	`editing_metadata` text,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` numeric DEFAULT '2025-07-07T04:36:01.067Z' NOT NULL,
	`updated_at` numeric DEFAULT '2025-07-07T04:36:01.067Z' NOT NULL,
	`_save_count` integer DEFAULT 0 NOT NULL,
	`_comment_count` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `user_posts_idx` ON `post` (`user_id`);--> statement-breakpoint
CREATE INDEX `post_time_idx` ON `post` (`created_at`);--> statement-breakpoint
CREATE INDEX `post_discovery_idx` ON `post` (`is_draft`,`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `post_popularity_idx` ON `post` (`_save_count`,`_comment_count`,`created_at`);--> statement-breakpoint
CREATE INDEX `user_posts_time_idx` ON `post` (`user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `post_hashtag` (
	`post_id` text NOT NULL,
	`hashtag_id` text NOT NULL,
	`created_at` numeric DEFAULT '2025-07-07T04:36:01.069Z' NOT NULL,
	FOREIGN KEY (`post_id`) REFERENCES `post`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`hashtag_id`) REFERENCES `hashtag`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `post_hashtag_idx` ON `post_hashtag` (`post_id`);--> statement-breakpoint
CREATE INDEX `hashtag_post_idx` ON `post_hashtag` (`hashtag_id`);--> statement-breakpoint
CREATE INDEX `post_hashtag_composite_idx` ON `post_hashtag` (`post_id`,`hashtag_id`);--> statement-breakpoint
CREATE TABLE `post_like` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`post_id` text NOT NULL,
	`created_at` numeric DEFAULT '2025-07-07T04:36:01.069Z' NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`post_id`) REFERENCES `post`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `user_post_likes_idx` ON `post_like` (`user_id`);--> statement-breakpoint
CREATE INDEX `post_likes_idx` ON `post_like` (`post_id`);--> statement-breakpoint
CREATE INDEX `post_like_composite_idx` ON `post_like` (`user_id`,`post_id`);--> statement-breakpoint
CREATE TABLE `post_version_history` (
	`id` text PRIMARY KEY NOT NULL,
	`post_id` text NOT NULL,
	`draft_post_id` text,
	`version` integer NOT NULL,
	`content` text NOT NULL,
	`editing_metadata` text,
	`change_type` text NOT NULL,
	`change_description` text,
	`user_id` text NOT NULL,
	`created_at` numeric DEFAULT '2025-07-07T04:36:01.068Z' NOT NULL,
	FOREIGN KEY (`post_id`) REFERENCES `post`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`draft_post_id`) REFERENCES `draft_post`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `post_version_history_post_idx` ON `post_version_history` (`post_id`);--> statement-breakpoint
CREATE INDEX `post_version_history_draft_idx` ON `post_version_history` (`draft_post_id`);--> statement-breakpoint
CREATE INDEX `post_version_history_user_idx` ON `post_version_history` (`user_id`);--> statement-breakpoint
CREATE INDEX `post_version_history_time_idx` ON `post_version_history` (`created_at`);--> statement-breakpoint
CREATE TABLE `profile` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`username` text NOT NULL,
	`profile_image` text,
	`bio` text,
	`verified_type` text DEFAULT 'none',
	`is_private` integer DEFAULT 0 NOT NULL,
	`created_at` numeric DEFAULT '2025-07-07T04:36:01.066Z' NOT NULL,
	`updated_at` numeric DEFAULT '2025-07-07T04:36:01.066Z' NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `profile_user_id_unique` ON `profile` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `profile_username_unique` ON `profile` (`username`);--> statement-breakpoint
CREATE INDEX `profile_privacy_idx` ON `profile` (`is_private`,`user_id`);--> statement-breakpoint
CREATE INDEX `profile_username_search_idx` ON `profile` (`username`);--> statement-breakpoint
CREATE TABLE `relationship` (
	`id` text PRIMARY KEY NOT NULL,
	`follower_id` text NOT NULL,
	`followed_id` text NOT NULL,
	`created_at` numeric DEFAULT '2025-07-07T04:36:01.069Z' NOT NULL,
	FOREIGN KEY (`follower_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`followed_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `follower_idx` ON `relationship` (`follower_id`);--> statement-breakpoint
CREATE INDEX `followed_idx` ON `relationship` (`followed_id`);--> statement-breakpoint
CREATE INDEX `relationship_composite_idx` ON `relationship` (`follower_id`,`followed_id`);--> statement-breakpoint
CREATE TABLE `saved_posts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`post_id` text NOT NULL,
	`created_at` numeric DEFAULT '2025-07-07T04:36:01.068Z' NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`post_id`) REFERENCES `post`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `user_saved_idx` ON `saved_posts` (`user_id`);--> statement-breakpoint
CREATE INDEX `post_saved_idx` ON `saved_posts` (`post_id`);--> statement-breakpoint
CREATE TABLE `seen_post_log` (
	`user_id` text NOT NULL,
	`post_id` text NOT NULL,
	`seen_at` numeric DEFAULT '2025-07-07T04:36:01.069Z' NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`post_id`) REFERENCES `post`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `seen_post_user_id_idx` ON `seen_post_log` (`user_id`);--> statement-breakpoint
CREATE INDEX `seen_post_seen_at_idx` ON `seen_post_log` (`seen_at`);--> statement-breakpoint
CREATE INDEX `seen_post_composite_idx` ON `seen_post_log` (`user_id`,`post_id`);--> statement-breakpoint
CREATE INDEX `seen_post_user_time_idx` ON `seen_post_log` (`user_id`,`seen_at`);--> statement-breakpoint
CREATE TABLE `user_activity` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`event_type` text NOT NULL,
	`created_at` numeric DEFAULT '2025-07-07T04:36:01.069Z' NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `user_activity_user_idx` ON `user_activity` (`user_id`);--> statement-breakpoint
CREATE INDEX `user_activity_time_idx` ON `user_activity` (`created_at`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`email_verified` integer DEFAULT 0 NOT NULL,
	`phone` text,
	`phone_verified` integer DEFAULT 0 NOT NULL,
	`apple_id` text,
	`created_at` numeric DEFAULT '2025-07-07T04:36:01.064Z' NOT NULL,
	`updated_at` numeric DEFAULT '2025-07-07T04:36:01.065Z' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_apple_id_unique` ON `users` (`apple_id`);