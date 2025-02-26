PRAGMA foreign_keys=OFF;

-- Create a new version of the media table with your desired changes
CREATE TABLE `__new_media` (
    `id` text PRIMARY KEY NOT NULL,
    `user_id` text,
    `post_id` text,
    `type` text NOT NULL,
    `storage_key` text NOT NULL,
    `order` integer NOT NULL,
    `created_at` numeric DEFAULT CURRENT_TIMESTAMP NOT NULL,
    FOREIGN KEY (`user_id`) REFERENCES `profile`(`user_id`) ON UPDATE no action ON DELETE no action,
    FOREIGN KEY (`post_id`) REFERENCES `post`(`id`) ON UPDATE no action ON DELETE no action
);

-- Copy data from the old table to the new one, renaming 'url' to 'storage_key' and omitting 'thumbnail_url'
INSERT INTO `__new_media`(`id`, `user_id`, `post_id`, `type`, `storage_key`, `order`, `created_at`)
SELECT `id`, `user_id`, `post_id`, `type`, `url`, `order`, `created_at` FROM `media`;

-- Drop the old table
DROP TABLE `media`;

-- Rename the new table to the original name
ALTER TABLE `__new_media` RENAME TO `media`;

-- Recreate any indices that existed on the original table
CREATE INDEX `post_media_idx` ON `media` (`post_id`);
CREATE INDEX `user_media_idx` ON `media` (`user_id`);

PRAGMA foreign_keys=ON;