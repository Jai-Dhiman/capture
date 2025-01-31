import { sqliteTable, text, integer, numeric } from 'drizzle-orm/sqlite-core'

export const user = sqliteTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: integer('email_verified', { mode: 'boolean' }).notNull(),
  image: text('image'),
  bio: text('bio'),
  mediaVerifiedType: text('media_verified_type').default('none'),
  createdAt: numeric('created_at').default(new Date().toISOString()).notNull(),
  updatedAt: numeric('updated_at').default(new Date().toISOString()).notNull(),
})

export const post = sqliteTable('post', {
  id: text('id').primaryKey(),
  userId: text('user_id').references(() => user.id),
  content: text('content').notNull(),
  createdAt: numeric('created_at').default(new Date().toISOString()).notNull(),
})

export const media = sqliteTable('media', {
  id: text('id').primaryKey(),
  userId: text('user_id').references(() => user.id),
  postId: text('post_id').references(() => post.id),
  type: text('type').notNull(),
  url: text('url').notNull(),
  thumbnailUrl: text('thumbnail_url'),
  order: integer('order').notNull(),
  createdAt: numeric('created_at').default(new Date().toISOString()).notNull(),
})

const commentTableName = 'comment' as const
export const comment = sqliteTable(commentTableName, {
  id: text('id').primaryKey(),
  postId: text('post_id').references(() => post.id),
  userId: text('user_id').references(() => user.id),
  content: text('content').notNull(),
  parentCommentId: text('parent_comment_id').references((): any => comment.id),
  createdAt: numeric('created_at').default(new Date().toISOString()).notNull(),
})

export const savedPost = sqliteTable('saved_posts', {
  id: text('id').primaryKey(),
  userId: text('user_id').references(() => user.id),
  postId: text('post_id').references(() => post.id),
  createdAt: numeric('created_at').default(new Date().toISOString()).notNull(),
})

export const captag = sqliteTable('captag', {
  id: text('id').primaryKey(),
  name: text('name').notNull().unique(),
  createdAt: numeric('created_at').default(new Date().toISOString()).notNull(),
})

export const postCaptag = sqliteTable('post_captag', {
  postId: text('post_id').references(() => post.id),
  captagId: text('hashtag_id').references(() => captag.id),
  createdAt: numeric('created_at').default(new Date().toISOString()).notNull(),
})

export const relationship = sqliteTable('relationship', {
  id: text('id').primaryKey(),
  followerId: text('follower_id').references(() => user.id),
  followedId: text('followed_id').references(() => user.id),
  createdAt: numeric('created_at').default(new Date().toISOString()).notNull(),
})
