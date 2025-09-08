-- Safe migration to add _like_count column to posts table
-- This avoids the foreign key constraint issues of the generated migration

-- Add the _like_count column to the post table
ALTER TABLE `post` ADD COLUMN `_like_count` INTEGER DEFAULT 0 NOT NULL;

-- Update the popularity index to include like count
DROP INDEX IF EXISTS `post_popularity_idx`;
CREATE INDEX `post_popularity_idx` ON `post` (`_save_count`,`_comment_count`,`_like_count`,`created_at`);

-- Populate existing like counts from post_like table
UPDATE `post` SET `_like_count` = (
  SELECT COUNT(*) 
  FROM `post_like` 
  WHERE `post_like`.`post_id` = `post`.`id`
);