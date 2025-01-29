import { pgTable, text, integer, timestamp, boolean } from 'drizzle-orm/pg-core'

export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull(),
  image: text('image'),
  bio: text('bio'),
  mediaVerifiedType: text('media_verified_type').default('none'),
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
})

export const session = pgTable('session', {
  id: text('id').primaryKey(),
  expiresAt: timestamp('expires_at').notNull(),
  token: text('token').notNull().unique(),
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  userId: text('user_id')
    .notNull()
    .references(() => user.id),
})

export const account = pgTable('account', {
  id: text('id').primaryKey(),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at'),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
  scope: text('scope'),
  password: text('password'),
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
})

export const verification = pgTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at'),
  updatedAt: timestamp('updated_at'),
})

export const post = pgTable('post', {
  id: text('id').primaryKey(),
  userId: text('user_id').references(() => user.id),
  content: text('content').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const media = pgTable('media', {
  id: text('id').primaryKey(),
  userId: text('user_id').references(() => user.id),
  postId: text('post_id').references(() => post.id),
  type: text('type').notNull(),
  url: text('url').notNull(),
  thumbnailUrl: text('thumbnail_url'),
  order: integer('order').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

const commentTableName = 'comment' as const
export const comment = pgTable(commentTableName, {
  id: text('id').primaryKey(),
  postId: text('post_id').references(() => post.id),
  userId: text('user_id').references(() => user.id),
  content: text('content').notNull(),
  parentCommentId: text('parent_comment_id').references((): any => comment.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const savedPost = pgTable('saved_posts', {
  id: text('id').primaryKey(),
  userId: text('user_id').references(() => user.id),
  postId: text('post_id').references(() => post.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const captag = pgTable('captag', {
  id: text('id').primaryKey(),
  name: text('name').notNull().unique(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const postCaptag = pgTable('post_captag', {
  postId: text('post_id').references(() => post.id),
  captagId: text('hashtag_id').references(() => captag.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const relationship = pgTable('relationship', {
  id: text('id').primaryKey(),
  followerId: text('follower_id').references(() => user.id),
  followedId: text('followed_id').references(() => user.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const schema = {
  user,
  session,
  account,
  verification,
  post,
  media,
  comment,
  savedPost,
  captag,
  postCaptag,
  relationship,
}
