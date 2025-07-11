import { foreignKey, index, integer, numeric, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { relations } from 'drizzle-orm';

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  emailVerified: integer('email_verified').default(0).notNull(),
  phone: text('phone'),
  phoneVerified: integer('phone_verified').default(0).notNull(),
  appleId: text('apple_id').unique(), // Apple Sign-In subject ID
  createdAt: numeric('created_at').default(new Date().toISOString()).notNull(),
  updatedAt: numeric('updated_at').default(new Date().toISOString()).notNull(),
});

export const profile = sqliteTable(
  'profile',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .unique()
      .references(() => users.id),
    username: text('username').notNull().unique(),
    profileImage: text('profile_image'),
    bio: text('bio'),
    verifiedType: text('verified_type').default('none'),
    isPrivate: integer('is_private').default(0).notNull(),
    createdAt: numeric('created_at').default(new Date().toISOString()).notNull(),
    updatedAt: numeric('updated_at').default(new Date().toISOString()).notNull(),
  },
  (table) => [
    // Privacy filtering optimization - compound index for discovery queries
    index('profile_privacy_idx').on(table.isPrivate, table.userId),
    // Username search optimization
    index('profile_username_search_idx').on(table.username),
  ],
);

export const emailCodes = sqliteTable(
  'email_codes',
  {
    id: text('id').primaryKey(),
    email: text('email').notNull(),
    code: text('code').notNull(),
    type: text('type').notNull(), // 'login_register' or 'verification'
    expiresAt: numeric('expires_at').notNull(),
    createdAt: numeric('created_at').default(new Date().toISOString()).notNull(),
    usedAt: numeric('used_at'), // null until used
  },
  (table) => [
    index('email_codes_email_idx').on(table.email),
    index('email_codes_expires_idx').on(table.expiresAt),
    index('email_codes_code_idx').on(table.code),
  ],
);

export const passkeys = sqliteTable(
  'passkeys',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    credentialId: text('credential_id').notNull().unique(),
    publicKey: text('public_key').notNull(),
    counter: integer('counter').default(0).notNull(),
    deviceName: text('device_name'),
    createdAt: numeric('created_at').default(new Date().toISOString()).notNull(),
    lastUsedAt: numeric('last_used_at'),
  },
  (table) => [
    index('passkeys_user_idx').on(table.userId),
    index('passkeys_credential_idx').on(table.credentialId),
  ],
);

export const post = sqliteTable(
  'post',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    content: text('content').notNull(),
    type: text('type').default('post').notNull(),
    isDraft: integer('is_draft').default(0).notNull(),
    editingMetadata: text('editing_metadata'), // JSON string
    version: integer('version').default(1).notNull(),
    createdAt: numeric('created_at').default(new Date().toISOString()).notNull(),
    updatedAt: numeric('updated_at').default(new Date().toISOString()).notNull(),
    _saveCount: integer('_save_count').default(0).notNull(),
    _commentCount: integer('_comment_count').default(0).notNull(),
  },
  (table) => [
    index('user_posts_idx').on(table.userId), 
    index('post_time_idx').on(table.createdAt),
    // Discovery feed optimization - compound index for filtering by draft status, userId, and sorting
    index('post_discovery_idx').on(table.isDraft, table.userId, table.createdAt),
    // Post popularity index for sorting by engagement
    index('post_popularity_idx').on(table._saveCount, table._commentCount, table.createdAt),
    // User content overview index
    index('user_posts_time_idx').on(table.userId, table.createdAt),
  ],
);

export const postRelations = relations(post, ({ one, many }) => ({
  user: one(users, {
    fields: [post.userId],
    references: [users.id],
  }),
  media: many(media),
  comments: many(comment),
  savedBy: many(savedPost),
  hashtags: many(postHashtag),
}));

export const draftPost = sqliteTable(
  'draft_post',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    content: text('content').notNull(),
    type: text('type').default('post').notNull(),
    editingMetadata: text('editing_metadata'), // JSON string
    version: integer('version').default(1).notNull(),
    createdAt: numeric('created_at').default(new Date().toISOString()).notNull(),
    updatedAt: numeric('updated_at').default(new Date().toISOString()).notNull(),
  },
  (table) => [
    index('user_drafts_idx').on(table.userId),
    index('draft_time_idx').on(table.updatedAt),
  ],
);

export const draftPostRelations = relations(draftPost, ({ one, many }) => ({
  user: one(users, {
    fields: [draftPost.userId],
    references: [users.id],
  }),
  media: many(media),
  hashtags: many(draftPostHashtag),
}));

export const draftPostHashtag = sqliteTable(
  'draft_post_hashtag',
  {
    draftPostId: text('draft_post_id')
      .notNull()
      .references(() => draftPost.id),
    hashtagId: text('hashtag_id')
      .notNull()
      .references(() => hashtag.id),
    createdAt: numeric('created_at').default(new Date().toISOString()).notNull(),
  },
  (table) => [
    index('draft_post_hashtag_idx').on(table.draftPostId),
    index('draft_hashtag_post_idx').on(table.hashtagId),
  ],
);

export const draftPostHashtagRelations = relations(draftPostHashtag, ({ one }) => ({
  draftPost: one(draftPost, {
    fields: [draftPostHashtag.draftPostId],
    references: [draftPost.id],
  }),
  hashtag: one(hashtag, {
    fields: [draftPostHashtag.hashtagId],
    references: [hashtag.id],
  }),
}));

export const postVersionHistory = sqliteTable(
  'post_version_history',
  {
    id: text('id').primaryKey(),
    postId: text('post_id')
      .notNull()
      .references(() => post.id),
    draftPostId: text('draft_post_id').references(() => draftPost.id),
    version: integer('version').notNull(),
    content: text('content').notNull(),
    editingMetadata: text('editing_metadata'), // JSON string
    changeType: text('change_type').notNull(), // 'created', 'edited', 'published', 'reverted'
    changeDescription: text('change_description'), // Human-readable description
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    createdAt: numeric('created_at').default(new Date().toISOString()).notNull(),
  },
  (table) => [
    index('post_version_history_post_idx').on(table.postId),
    index('post_version_history_draft_idx').on(table.draftPostId),
    index('post_version_history_user_idx').on(table.userId),
    index('post_version_history_time_idx').on(table.createdAt),
  ],
);

export const postVersionHistoryRelations = relations(postVersionHistory, ({ one }) => ({
  post: one(post, {
    fields: [postVersionHistory.postId],
    references: [post.id],
  }),
  draftPost: one(draftPost, {
    fields: [postVersionHistory.draftPostId],
    references: [draftPost.id],
  }),
  user: one(users, {
    fields: [postVersionHistory.userId],
    references: [users.id],
  }),
}));

export const media = sqliteTable(
  'media',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    postId: text('post_id').references(() => post.id),
    draftPostId: text('draft_post_id').references(() => draftPost.id),
    type: text('type').notNull(),
    storageKey: text('storage_key').notNull(),
    order: integer('order').notNull(),
    createdAt: numeric('created_at').default(new Date().toISOString()).notNull(),
  },
  (table) => [
    index('post_media_idx').on(table.postId),
    index('draft_media_idx').on(table.draftPostId),
    index('user_media_idx').on(table.userId),
  ],
);

export const mediaRelations = relations(media, ({ one }) => ({
  post: one(post, {
    fields: [media.postId],
    references: [post.id],
  }),
  draftPost: one(draftPost, {
    fields: [media.draftPostId],
    references: [draftPost.id],
  }),
  user: one(users, {
    fields: [media.userId],
    references: [users.id],
  }),
}));

export const comment = sqliteTable(
  'comment',
  {
    id: text('id').primaryKey(),
    postId: text('post_id')
      .notNull()
      .references(() => post.id),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    parentId: text('parent_id'),
    content: text('content').notNull(),
    path: text('path').notNull(),
    depth: integer('depth').notNull().default(0),
    isDeleted: integer('is_deleted').notNull().default(0),
    createdAt: numeric('created_at').default(new Date().toISOString()).notNull(),
    _likeCount: integer('_like_count').notNull().default(0),
  },
  (table) => [
    index('post_comments_idx').on(table.postId),
    index('user_comments_idx').on(table.userId),
    index('comment_path_idx').on(table.path),
    index('comment_parent_idx').on(table.parentId),
    // Comment threading optimization - compound index for parent-child relationships
    index('comment_threading_idx').on(table.postId, table.parentId, table.depth, table.createdAt),
    // Comment popularity index for sorting by engagement
    index('comment_popularity_idx').on(table.postId, table._likeCount, table.createdAt),
    foreignKey({
      columns: [table.parentId],
      foreignColumns: [table.id],
      name: 'comment_parent_fkey',
    }),
  ],
);

export const savedPost = sqliteTable(
  'saved_posts',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    postId: text('post_id')
      .notNull()
      .references(() => post.id),
    createdAt: numeric('created_at').default(new Date().toISOString()).notNull(),
  },
  (table) => [index('user_saved_idx').on(table.userId), index('post_saved_idx').on(table.postId)],
);

export const hashtag = sqliteTable(
  'hashtag',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull().unique(),
    createdAt: numeric('created_at').default(new Date().toISOString()).notNull(),
  },
  (table) => [index('hashtag_name_idx').on(table.name)],
);

export const postHashtag = sqliteTable(
  'post_hashtag',
  {
    postId: text('post_id')
      .notNull()
      .references(() => post.id),
    hashtagId: text('hashtag_id')
      .notNull()
      .references(() => hashtag.id),
    createdAt: numeric('created_at').default(new Date().toISOString()).notNull(),
  },
  (table) => [
    index('post_hashtag_idx').on(table.postId),
    index('hashtag_post_idx').on(table.hashtagId),
    index('post_hashtag_composite_idx').on(table.postId, table.hashtagId),
  ],
);

export const postHashtagRelations = relations(postHashtag, ({ one }) => ({
  post: one(post, {
    fields: [postHashtag.postId],
    references: [post.id],
  }),
  hashtag: one(hashtag, {
    fields: [postHashtag.hashtagId],
    references: [hashtag.id],
  }),
}));

export const relationship = sqliteTable(
  'relationship',
  {
    id: text('id').primaryKey(),
    followerId: text('follower_id')
      .notNull()
      .references(() => users.id),
    followedId: text('followed_id')
      .notNull()
      .references(() => users.id),
    createdAt: numeric('created_at').default(new Date().toISOString()).notNull(),
  },
  (table) => [
    index('follower_idx').on(table.followerId),
    index('followed_idx').on(table.followedId),
    index('relationship_composite_idx').on(table.followerId, table.followedId),
  ],
);

export const blockedUser = sqliteTable(
  'blocked_user',
  {
    id: text('id').primaryKey(),
    blockerId: text('blocker_id')
      .notNull()
      .references(() => users.id),
    blockedId: text('blocked_id')
      .notNull()
      .references(() => users.id),
    createdAt: numeric('created_at').default(new Date().toISOString()).notNull(),
  },
  (table) => [
    index('blocker_idx').on(table.blockerId),
    index('blocked_idx').on(table.blockedId),
    index('block_relationship_idx').on(table.blockerId, table.blockedId),
  ],
);

export const postLike = sqliteTable(
  'post_like',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    postId: text('post_id')
      .notNull()
      .references(() => post.id),
    createdAt: numeric('created_at').default(new Date().toISOString()).notNull(),
  },
  (table) => [
    index('user_post_likes_idx').on(table.userId),
    index('post_likes_idx').on(table.postId),
    index('post_like_composite_idx').on(table.userId, table.postId),
  ],
);

export const commentLike = sqliteTable(
  'comment_like',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    commentId: text('comment_id')
      .notNull()
      .references(() => comment.id),
    createdAt: numeric('created_at').default(new Date().toISOString()).notNull(),
  },
  (table) => [
    index('user_comment_likes_idx').on(table.userId),
    index('comment_likes_idx').on(table.commentId),
    index('comment_like_composite_idx').on(table.userId, table.commentId),
  ],
);

export const seenPostLog = sqliteTable(
  'seen_post_log',
  {
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    postId: text('post_id')
      .notNull()
      .references(() => post.id),
    seenAt: numeric('seen_at').default(new Date().toISOString()).notNull(),
  },
  (table) => [
    index('seen_post_user_id_idx').on(table.userId),
    index('seen_post_seen_at_idx').on(table.seenAt),
    index('seen_post_composite_idx').on(table.userId, table.postId),
    // Seen posts optimization - compound index for user timeline queries
    index('seen_post_user_time_idx').on(table.userId, table.seenAt),
  ],
);

export const notification = sqliteTable(
  'notification',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    type: text('type').notNull(),
    actionUserId: text('action_user_id').references(() => users.id),
    resourceId: text('resource_id'),
    resourceType: text('resource_type'),
    message: text('message').notNull(),
    isRead: integer('is_read').default(0).notNull(),
    createdAt: numeric('created_at').default(new Date().toISOString()).notNull(),
  },
  (table) => [
    index('user_notifications_idx').on(table.userId),
    index('notification_time_idx').on(table.createdAt),
    index('notification_read_idx').on(table.isRead),
    // Notification optimization - compound index for user feed queries
    index('notification_user_read_time_idx').on(table.userId, table.isRead, table.createdAt),
    // Notification type filtering index
    index('notification_user_type_idx').on(table.userId, table.type, table.createdAt),
  ],
);

export const notificationSettings = sqliteTable('notification_settings', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id)
    .unique(),
  enableInApp: integer('enable_in_app').default(1).notNull(),
  enablePush: integer('enable_push').default(1).notNull(),
  frequency: text('frequency').default('IMMEDIATE').notNull(),
  createdAt: numeric('created_at').default(new Date().toISOString()).notNull(),
  updatedAt: numeric('updated_at').default(new Date().toISOString()).notNull(),
});

export const userActivity = sqliteTable(
  'user_activity',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    eventType: text('event_type').notNull(),
    createdAt: numeric('created_at').notNull().default(new Date().toISOString()),
  },
  (table) => [
    index('user_activity_user_idx').on(table.userId),
    index('user_activity_time_idx').on(table.createdAt),
  ],
);
