import { sqliteTable, text, integer, numeric, index, foreignKey } from "drizzle-orm/sqlite-core";

export const profile = sqliteTable("profile", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().unique(),
  username: text("username").notNull().unique(),
  profileImage: text("profile_image"),
  bio: text("bio"),
  verifiedType: text("verified_type").default("none"),
  createdAt: numeric("created_at").default(new Date().toISOString()).notNull(),
  updatedAt: numeric("updated_at").default(new Date().toISOString()).notNull(),
});

export const post = sqliteTable(
  "post",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => profile.userId),
    content: text("content").notNull(),
    type: text("type").default("post").notNull(),
    createdAt: numeric("created_at").default(new Date().toISOString()).notNull(),
  },
  (table) => [index("user_posts_idx").on(table.userId), index("post_time_idx").on(table.createdAt)]
);

export const media = sqliteTable(
  "media",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => profile.userId),
    postId: text("post_id").references(() => post.id),
    type: text("type").notNull(),
    storageKey: text("storage_key").notNull(),
    order: integer("order").notNull(),
    createdAt: numeric("created_at").default(new Date().toISOString()).notNull(),
  },
  (table) => [index("post_media_idx").on(table.postId), index("user_media_idx").on(table.userId)]
);

export const comment = sqliteTable(
  "comment",
  {
    id: text("id").primaryKey(),
    postId: text("post_id")
      .notNull()
      .references(() => post.id),
    userId: text("user_id")
      .notNull()
      .references(() => profile.userId),
    parentId: text("parent_id"),
    content: text("content").notNull(),
    path: text("path").notNull(),
    depth: integer("depth").notNull().default(0),
    isDeleted: integer("is_deleted").notNull().default(0),
    createdAt: numeric("created_at").default(new Date().toISOString()).notNull(),
  },
  (table) => [
    index("post_comments_idx").on(table.postId),
    index("user_comments_idx").on(table.userId),
    index("comment_path_idx").on(table.path),
    index("comment_parent_idx").on(table.parentId),
    foreignKey({
      columns: [table.parentId],
      foreignColumns: [table.id],
      name: "comment_parent_fkey",
    }),
  ]
);

export const savedPost = sqliteTable(
  "saved_posts",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => profile.userId),
    postId: text("post_id")
      .notNull()
      .references(() => post.id),
    createdAt: numeric("created_at").default(new Date().toISOString()).notNull(),
  },
  (table) => [index("user_saved_idx").on(table.userId), index("post_saved_idx").on(table.postId)]
);

export const hashtag = sqliteTable(
  "hashtag",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull().unique(),
    createdAt: numeric("created_at").default(new Date().toISOString()).notNull(),
  },
  (table) => [index("hashtag_name_idx").on(table.name)]
);

export const postHashtag = sqliteTable(
  "post_hashtag",
  {
    postId: text("post_id")
      .notNull()
      .references(() => post.id),
    hashtagId: text("hashtag_id")
      .notNull()
      .references(() => hashtag.id),
    createdAt: numeric("created_at").default(new Date().toISOString()).notNull(),
  },
  (table) => [
    index("post_hashtag_idx").on(table.postId),
    index("hashtag_post_idx").on(table.hashtagId),
    index("post_hashtag_composite_idx").on(table.postId, table.hashtagId),
  ]
);

export const relationship = sqliteTable(
  "relationship",
  {
    id: text("id").primaryKey(),
    followerId: text("follower_id")
      .notNull()
      .references(() => profile.userId),
    followedId: text("followed_id")
      .notNull()
      .references(() => profile.userId),
    createdAt: numeric("created_at").default(new Date().toISOString()).notNull(),
  },
  (table) => [
    index("follower_idx").on(table.followerId),
    index("followed_idx").on(table.followedId),
    index("relationship_composite_idx").on(table.followerId, table.followedId),
  ]
);
