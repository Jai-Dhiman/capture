import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'

// Core user table with minimal info
export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  username: text('username').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
})

// Basic posts table
export const posts = sqliteTable('posts', {
  id: text('id').primaryKey(),
  userId: text('user_id').references(() => users.id),
  content: text('content').notNull(),
  mediaUrl: text('media_url'), // Single media URL for now
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
})

// Simple relationships table
export const relationships = sqliteTable('relationships', {
  id: text('id').primaryKey(),
  followerId: text('follower_id').references(() => users.id),
  followedId: text('followed_id').references(() => users.id),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
})
