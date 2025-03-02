PRAGMA foreign_keys = OFF;

-- Drop all tables
DROP TABLE IF EXISTS profile;
DROP TABLE IF EXISTS post;
DROP TABLE IF EXISTS media;
DROP TABLE IF EXISTS comment;
DROP TABLE IF EXISTS saved_posts;
DROP TABLE IF EXISTS post_hashtag;
DROP TABLE IF EXISTS hashtag;  -- We're dropping the original hashtag table
DROP TABLE IF EXISTS relationship;

PRAGMA foreign_keys = ON;

CREATE TABLE `comment` (
	`id` text PRIMARY KEY NOT NULL,
	`post_id` text,
	`user_id` text,
	`content` text NOT NULL,
	`parent_comment_id` text,
	`created_at` numeric DEFAULT '2025-03-02T08:22:39.914Z' NOT NULL,
	FOREIGN KEY (`post_id`) REFERENCES `post`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `profile`(`user_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`parent_comment_id`) REFERENCES `comment`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `post_comments_idx` ON `comment` (`post_id`);--> statement-breakpoint
CREATE INDEX `user_comments_idx` ON `comment` (`user_id`);--> statement-breakpoint
CREATE INDEX `parent_comment_idx` ON `comment` (`parent_comment_id`);--> statement-breakpoint
CREATE TABLE `hashtag` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`created_at` numeric DEFAULT '2025-03-02T08:22:39.915Z' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `hashtag_name_unique` ON `hashtag` (`name`);--> statement-breakpoint
CREATE INDEX `hashtag_name_idx` ON `hashtag` (`name`);--> statement-breakpoint
CREATE TABLE `media` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`post_id` text,
	`type` text NOT NULL,
	`storage_key` text NOT NULL,
	`order` integer NOT NULL,
	`created_at` numeric DEFAULT '2025-03-02T08:22:39.914Z' NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `profile`(`user_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`post_id`) REFERENCES `post`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `post_media_idx` ON `media` (`post_id`);--> statement-breakpoint
CREATE INDEX `user_media_idx` ON `media` (`user_id`);--> statement-breakpoint
CREATE TABLE `post` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`content` text NOT NULL,
	`created_at` numeric DEFAULT '2025-03-02T08:22:39.913Z' NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `profile`(`user_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `user_posts_idx` ON `post` (`user_id`);--> statement-breakpoint
CREATE INDEX `post_time_idx` ON `post` (`created_at`);--> statement-breakpoint
CREATE TABLE `post_hashtag` (
	`post_id` text,
	`hashtag_id` text,
	`created_at` numeric DEFAULT '2025-03-02T08:22:39.915Z' NOT NULL,
	FOREIGN KEY (`post_id`) REFERENCES `post`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`hashtag_id`) REFERENCES `hashtag`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `post_hashtag_idx` ON `post_hashtag` (`post_id`);--> statement-breakpoint
CREATE INDEX `hashtag_post_idx` ON `post_hashtag` (`hashtag_id`);--> statement-breakpoint
CREATE INDEX `post_hashtag_composite_idx` ON `post_hashtag` (`post_id`,`hashtag_id`);--> statement-breakpoint
CREATE TABLE `profile` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`username` text NOT NULL,
	`profile_image` text,
	`bio` text,
	`verified_type` text DEFAULT 'none',
	`created_at` numeric DEFAULT '2025-03-02T08:22:39.907Z' NOT NULL,
	`updated_at` numeric DEFAULT '2025-03-02T08:22:39.912Z' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `profile_user_id_unique` ON `profile` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `profile_username_unique` ON `profile` (`username`);--> statement-breakpoint
CREATE TABLE `relationship` (
	`id` text PRIMARY KEY NOT NULL,
	`follower_id` text,
	`followed_id` text,
	`created_at` numeric DEFAULT '2025-03-02T08:22:39.915Z' NOT NULL,
	FOREIGN KEY (`follower_id`) REFERENCES `profile`(`user_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`followed_id`) REFERENCES `profile`(`user_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `follower_idx` ON `relationship` (`follower_id`);--> statement-breakpoint
CREATE INDEX `followed_idx` ON `relationship` (`followed_id`);--> statement-breakpoint
CREATE INDEX `relationship_composite_idx` ON `relationship` (`follower_id`,`followed_id`);--> statement-breakpoint
CREATE TABLE `saved_posts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`post_id` text,
	`created_at` numeric DEFAULT '2025-03-02T08:22:39.915Z' NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `profile`(`user_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`post_id`) REFERENCES `post`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `user_saved_idx` ON `saved_posts` (`user_id`);--> statement-breakpoint
CREATE INDEX `post_saved_idx` ON `saved_posts` (`post_id`);