DROP TABLE IF EXISTS blocked_user;
DROP TABLE IF EXISTS relationship;
DROP TABLE IF EXISTS post_hashtag;
DROP TABLE IF EXISTS hashtag;
DROP TABLE IF EXISTS saved_posts;
DROP TABLE IF EXISTS comment;
DROP TABLE IF EXISTS media;
DROP TABLE IF EXISTS post;
DROP TABLE IF EXISTS profile;

CREATE TABLE `blocked_user` (
	`id` text PRIMARY KEY NOT NULL,
	`blocker_id` text NOT NULL,
	`blocked_id` text NOT NULL,
	`created_at` numeric DEFAULT '2025-04-17T20:00:18.623Z' NOT NULL,
	FOREIGN KEY (`blocker_id`) REFERENCES `profile`(`user_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`blocked_id`) REFERENCES `profile`(`user_id`) ON UPDATE no action ON DELETE no action
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
	`created_at` numeric DEFAULT '2025-04-17T20:00:18.622Z' NOT NULL,
	FOREIGN KEY (`post_id`) REFERENCES `post`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `profile`(`user_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`parent_id`) REFERENCES `comment`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `post_comments_idx` ON `comment` (`post_id`);--> statement-breakpoint
CREATE INDEX `user_comments_idx` ON `comment` (`user_id`);--> statement-breakpoint
CREATE INDEX `comment_path_idx` ON `comment` (`path`);--> statement-breakpoint
CREATE INDEX `comment_parent_idx` ON `comment` (`parent_id`);--> statement-breakpoint
CREATE TABLE `hashtag` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`created_at` numeric DEFAULT '2025-04-17T20:00:18.622Z' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `hashtag_name_unique` ON `hashtag` (`name`);--> statement-breakpoint
CREATE INDEX `hashtag_name_idx` ON `hashtag` (`name`);--> statement-breakpoint
CREATE TABLE `media` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`post_id` text,
	`type` text NOT NULL,
	`storage_key` text NOT NULL,
	`order` integer NOT NULL,
	`created_at` numeric DEFAULT '2025-04-17T20:00:18.622Z' NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `profile`(`user_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`post_id`) REFERENCES `post`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `post_media_idx` ON `media` (`post_id`);--> statement-breakpoint
CREATE INDEX `user_media_idx` ON `media` (`user_id`);--> statement-breakpoint
CREATE TABLE `post` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`content` text NOT NULL,
	`type` text DEFAULT 'post' NOT NULL,
	`created_at` numeric DEFAULT '2025-04-17T20:00:18.621Z' NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `profile`(`user_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `user_posts_idx` ON `post` (`user_id`);--> statement-breakpoint
CREATE INDEX `post_time_idx` ON `post` (`created_at`);--> statement-breakpoint
CREATE TABLE `post_hashtag` (
	`post_id` text NOT NULL,
	`hashtag_id` text NOT NULL,
	`created_at` numeric DEFAULT '2025-04-17T20:00:18.622Z' NOT NULL,
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
	`is_private` integer DEFAULT 0 NOT NULL,
	`created_at` numeric DEFAULT '2025-04-17T20:00:18.615Z' NOT NULL,
	`updated_at` numeric DEFAULT '2025-04-17T20:00:18.620Z' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `profile_user_id_unique` ON `profile` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `profile_username_unique` ON `profile` (`username`);--> statement-breakpoint
CREATE TABLE `relationship` (
	`id` text PRIMARY KEY NOT NULL,
	`follower_id` text NOT NULL,
	`followed_id` text NOT NULL,
	`created_at` numeric DEFAULT '2025-04-17T20:00:18.622Z' NOT NULL,
	FOREIGN KEY (`follower_id`) REFERENCES `profile`(`user_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`followed_id`) REFERENCES `profile`(`user_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `follower_idx` ON `relationship` (`follower_id`);--> statement-breakpoint
CREATE INDEX `followed_idx` ON `relationship` (`followed_id`);--> statement-breakpoint
CREATE INDEX `relationship_composite_idx` ON `relationship` (`follower_id`,`followed_id`);--> statement-breakpoint
CREATE TABLE `saved_posts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`post_id` text NOT NULL,
	`created_at` numeric DEFAULT '2025-04-17T20:00:18.622Z' NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `profile`(`user_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`post_id`) REFERENCES `post`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `user_saved_idx` ON `saved_posts` (`user_id`);--> statement-breakpoint
CREATE INDEX `post_saved_idx` ON `saved_posts` (`post_id`);