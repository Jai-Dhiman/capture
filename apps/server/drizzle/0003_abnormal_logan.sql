-- Turn off foreign key constraints before dropping tables
PRAGMA foreign_keys=OFF;

-- Drop all tables in reverse order of dependencies
DROP TABLE IF EXISTS saved_posts;
DROP TABLE IF EXISTS relationship;
DROP TABLE IF EXISTS post_hashtag;
DROP TABLE IF EXISTS media;
DROP TABLE IF EXISTS comment;
DROP TABLE IF EXISTS post;
DROP TABLE IF EXISTS hashtag;
DROP TABLE IF EXISTS profile;

-- Create all tables directly with their final names
CREATE TABLE profile (
    id text PRIMARY KEY NOT NULL,
    user_id text NOT NULL,
    username text NOT NULL,
    profile_image text,
    bio text,
    verified_type text DEFAULT 'none',
    created_at numeric DEFAULT '2025-03-20T21:15:46.569Z' NOT NULL,
    updated_at numeric DEFAULT '2025-03-20T21:15:46.571Z' NOT NULL
);

CREATE UNIQUE INDEX profile_user_id_unique ON profile (user_id);
CREATE UNIQUE INDEX profile_username_unique ON profile (username);

CREATE TABLE hashtag (
    id text PRIMARY KEY NOT NULL,
    name text NOT NULL,
    created_at numeric DEFAULT '2025-03-20T21:15:46.573Z' NOT NULL
);

CREATE UNIQUE INDEX hashtag_name_unique ON hashtag (name);
CREATE INDEX hashtag_name_idx ON hashtag (name);

CREATE TABLE post (
    id text PRIMARY KEY NOT NULL,
    user_id text,
    content text NOT NULL,
    type text DEFAULT 'post' NOT NULL,
    created_at numeric DEFAULT '2025-03-20T21:15:46.571Z' NOT NULL,
    FOREIGN KEY (user_id) REFERENCES profile(user_id) ON UPDATE no action ON DELETE no action
);

CREATE INDEX user_posts_idx ON post (user_id);
CREATE INDEX post_time_idx ON post (created_at);

CREATE TABLE comment (
    id text PRIMARY KEY NOT NULL,
    post_id text,
    user_id text,
    parent_id text,
    content text NOT NULL,
    path text NOT NULL,
    depth integer DEFAULT 0 NOT NULL,
    is_deleted integer DEFAULT 0 NOT NULL,
    created_at numeric DEFAULT '2025-03-20T21:15:46.573Z' NOT NULL,
    FOREIGN KEY (post_id) REFERENCES post(id) ON UPDATE no action ON DELETE no action,
    FOREIGN KEY (user_id) REFERENCES profile(user_id) ON UPDATE no action ON DELETE no action,
    FOREIGN KEY (parent_id) REFERENCES comment(id) ON UPDATE no action ON DELETE no action
);

CREATE INDEX post_comments_idx ON comment (post_id);
CREATE INDEX user_comments_idx ON comment (user_id);
CREATE INDEX comment_path_idx ON comment (path);
CREATE INDEX comment_parent_idx ON comment (parent_id);

CREATE TABLE media (
    id text PRIMARY KEY NOT NULL,
    user_id text,
    post_id text,
    type text NOT NULL,
    storage_key text NOT NULL,
    "order" integer NOT NULL,
    created_at numeric DEFAULT '2025-03-20T21:15:46.572Z' NOT NULL,
    FOREIGN KEY (user_id) REFERENCES profile(user_id) ON UPDATE no action ON DELETE no action,
    FOREIGN KEY (post_id) REFERENCES post(id) ON UPDATE no action ON DELETE no action
);

CREATE INDEX post_media_idx ON media (post_id);
CREATE INDEX user_media_idx ON media (user_id);

CREATE TABLE post_hashtag (
    post_id text,
    hashtag_id text,
    created_at numeric DEFAULT '2025-03-20T21:15:46.573Z' NOT NULL,
    FOREIGN KEY (post_id) REFERENCES post(id) ON UPDATE no action ON DELETE no action,
    FOREIGN KEY (hashtag_id) REFERENCES hashtag(id) ON UPDATE no action ON DELETE no action
);

CREATE INDEX post_hashtag_idx ON post_hashtag (post_id);
CREATE INDEX hashtag_post_idx ON post_hashtag (hashtag_id);
CREATE INDEX post_hashtag_composite_idx ON post_hashtag (post_id,hashtag_id);

CREATE TABLE relationship (
    id text PRIMARY KEY NOT NULL,
    follower_id text,
    followed_id text,
    created_at numeric DEFAULT '2025-03-20T21:15:46.573Z' NOT NULL,
    FOREIGN KEY (follower_id) REFERENCES profile(user_id) ON UPDATE no action ON DELETE no action,
    FOREIGN KEY (followed_id) REFERENCES profile(user_id) ON UPDATE no action ON DELETE no action
);

CREATE INDEX follower_idx ON relationship (follower_id);
CREATE INDEX followed_idx ON relationship (followed_id);
CREATE INDEX relationship_composite_idx ON relationship (follower_id,followed_id);

CREATE TABLE saved_posts (
    id text PRIMARY KEY NOT NULL,
    user_id text,
    post_id text,
    created_at numeric DEFAULT '2025-03-20T21:15:46.573Z' NOT NULL,
    FOREIGN KEY (user_id) REFERENCES profile(user_id) ON UPDATE no action ON DELETE no action,
    FOREIGN KEY (post_id) REFERENCES post(id) ON UPDATE no action ON DELETE no action
);

CREATE INDEX user_saved_idx ON saved_posts (user_id);
CREATE INDEX post_saved_idx ON saved_posts (post_id);

-- Turn foreign key constraints back on
PRAGMA foreign_keys=ON;