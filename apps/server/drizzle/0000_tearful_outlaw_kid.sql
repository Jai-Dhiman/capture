CREATE TABLE `captag` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`created_at` numeric DEFAULT '2025-01-30T09:18:22.017Z' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `captag_name_unique` ON `captag` (`name`);--> statement-breakpoint
CREATE TABLE `comment` (
	`id` text PRIMARY KEY NOT NULL,
	`post_id` text,
	`user_id` text,
	`content` text NOT NULL,
	`parent_comment_id` text,
	`created_at` numeric DEFAULT '2025-01-30T09:18:22.017Z' NOT NULL,
	FOREIGN KEY (`post_id`) REFERENCES `post`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`parent_comment_id`) REFERENCES `comment`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `media` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`post_id` text,
	`type` text NOT NULL,
	`url` text NOT NULL,
	`thumbnail_url` text,
	`order` integer NOT NULL,
	`created_at` numeric DEFAULT '2025-01-30T09:18:22.016Z' NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`post_id`) REFERENCES `post`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `post` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`content` text NOT NULL,
	`created_at` numeric DEFAULT '2025-01-30T09:18:22.016Z' NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `post_captag` (
	`post_id` text,
	`hashtag_id` text,
	`created_at` numeric DEFAULT '2025-01-30T09:18:22.017Z' NOT NULL,
	FOREIGN KEY (`post_id`) REFERENCES `post`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`hashtag_id`) REFERENCES `captag`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `relationship` (
	`id` text PRIMARY KEY NOT NULL,
	`follower_id` text,
	`followed_id` text,
	`created_at` numeric DEFAULT '2025-01-30T09:18:22.017Z' NOT NULL,
	FOREIGN KEY (`follower_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`followed_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `saved_posts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`post_id` text,
	`created_at` numeric DEFAULT '2025-01-30T09:18:22.017Z' NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`post_id`) REFERENCES `post`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`email_verified` integer NOT NULL,
	`image` text,
	`bio` text,
	`media_verified_type` text DEFAULT 'none',
	`created_at` numeric DEFAULT '2025-01-30T09:18:22.007Z' NOT NULL,
	`updated_at` numeric DEFAULT '2025-01-30T09:18:22.015Z' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);