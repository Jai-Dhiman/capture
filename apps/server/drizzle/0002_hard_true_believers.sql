PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_comment` (
	`id` text PRIMARY KEY NOT NULL,
	`post_id` text,
	`user_id` text,
	`parent_id` text,
	`content` text NOT NULL,
	`path` text NOT NULL,
	`depth` integer DEFAULT 0 NOT NULL,
	`is_deleted` integer DEFAULT 0 NOT NULL,
	`created_at` numeric DEFAULT '2025-03-19T09:00:57.478Z' NOT NULL,
	FOREIGN KEY (`post_id`) REFERENCES `post`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `profile`(`user_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`parent_id`) REFERENCES `comment`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_comment`("id", "post_id", "user_id", "parent_id", "content", "path", "depth", "is_deleted", "created_at") SELECT "id", "post_id", "user_id", "parent_id", "content", "path", "depth", "is_deleted", "created_at" FROM `comment`;--> statement-breakpoint
DROP TABLE `comment`;--> statement-breakpoint
ALTER TABLE `__new_comment` RENAME TO `comment`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `post_comments_idx` ON `comment` (`post_id`);--> statement-breakpoint
CREATE INDEX `user_comments_idx` ON `comment` (`user_id`);--> statement-breakpoint
CREATE INDEX `comment_path_idx` ON `comment` (`path`);--> statement-breakpoint
CREATE INDEX `comment_parent_idx` ON `comment` (`parent_id`);--> statement-breakpoint
CREATE TABLE `__new_hashtag` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`created_at` numeric DEFAULT '2025-03-19T09:00:57.479Z' NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_hashtag`("id", "name", "created_at") SELECT "id", "name", "created_at" FROM `hashtag`;--> statement-breakpoint
DROP TABLE `hashtag`;--> statement-breakpoint
ALTER TABLE `__new_hashtag` RENAME TO `hashtag`;--> statement-breakpoint
CREATE UNIQUE INDEX `hashtag_name_unique` ON `hashtag` (`name`);--> statement-breakpoint
CREATE INDEX `hashtag_name_idx` ON `hashtag` (`name`);--> statement-breakpoint
CREATE TABLE `__new_media` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`post_id` text,
	`type` text NOT NULL,
	`storage_key` text NOT NULL,
	`order` integer NOT NULL,
	`created_at` numeric DEFAULT '2025-03-19T09:00:57.477Z' NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `profile`(`user_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`post_id`) REFERENCES `post`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_media`("id", "user_id", "post_id", "type", "storage_key", "order", "created_at") SELECT "id", "user_id", "post_id", "type", "storage_key", "order", "created_at" FROM `media`;--> statement-breakpoint
DROP TABLE `media`;--> statement-breakpoint
ALTER TABLE `__new_media` RENAME TO `media`;--> statement-breakpoint
CREATE INDEX `post_media_idx` ON `media` (`post_id`);--> statement-breakpoint
CREATE INDEX `user_media_idx` ON `media` (`user_id`);--> statement-breakpoint
CREATE TABLE `__new_post` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`content` text NOT NULL,
	`created_at` numeric DEFAULT '2025-03-19T09:00:57.476Z' NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `profile`(`user_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_post`("id", "user_id", "content", "created_at") SELECT "id", "user_id", "content", "created_at" FROM `post`;--> statement-breakpoint
DROP TABLE `post`;--> statement-breakpoint
ALTER TABLE `__new_post` RENAME TO `post`;--> statement-breakpoint
CREATE INDEX `user_posts_idx` ON `post` (`user_id`);--> statement-breakpoint
CREATE INDEX `post_time_idx` ON `post` (`created_at`);--> statement-breakpoint
CREATE TABLE `__new_post_hashtag` (
	`post_id` text,
	`hashtag_id` text,
	`created_at` numeric DEFAULT '2025-03-19T09:00:57.479Z' NOT NULL,
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
CREATE TABLE `__new_profile` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`username` text NOT NULL,
	`profile_image` text,
	`bio` text,
	`verified_type` text DEFAULT 'none',
	`created_at` numeric DEFAULT '2025-03-19T09:00:57.474Z' NOT NULL,
	`updated_at` numeric DEFAULT '2025-03-19T09:00:57.476Z' NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_profile`("id", "user_id", "username", "profile_image", "bio", "verified_type", "created_at", "updated_at") SELECT "id", "user_id", "username", "profile_image", "bio", "verified_type", "created_at", "updated_at" FROM `profile`;--> statement-breakpoint
DROP TABLE `profile`;--> statement-breakpoint
ALTER TABLE `__new_profile` RENAME TO `profile`;--> statement-breakpoint
CREATE UNIQUE INDEX `profile_user_id_unique` ON `profile` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `profile_username_unique` ON `profile` (`username`);--> statement-breakpoint
CREATE TABLE `__new_relationship` (
	`id` text PRIMARY KEY NOT NULL,
	`follower_id` text,
	`followed_id` text,
	`created_at` numeric DEFAULT '2025-03-19T09:00:57.479Z' NOT NULL,
	FOREIGN KEY (`follower_id`) REFERENCES `profile`(`user_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`followed_id`) REFERENCES `profile`(`user_id`) ON UPDATE no action ON DELETE no action
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
	`user_id` text,
	`post_id` text,
	`created_at` numeric DEFAULT '2025-03-19T09:00:57.479Z' NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `profile`(`user_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`post_id`) REFERENCES `post`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_saved_posts`("id", "user_id", "post_id", "created_at") SELECT "id", "user_id", "post_id", "created_at" FROM `saved_posts`;--> statement-breakpoint
DROP TABLE `saved_posts`;--> statement-breakpoint
ALTER TABLE `__new_saved_posts` RENAME TO `saved_posts`;--> statement-breakpoint
CREATE INDEX `user_saved_idx` ON `saved_posts` (`user_id`);--> statement-breakpoint
CREATE INDEX `post_saved_idx` ON `saved_posts` (`post_id`);