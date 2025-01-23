import { z } from 'zod';

// User validation
export const userSchema = z.object({
  id: z.string().uuid(),
  username: z.string()
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username cannot exceed 30 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores'),
  passwordHash: z.string(),
  createdAt: z.number(),
});

// Post validation
export const postSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  content: z.string()
    .min(1, 'Post cannot be empty')
    .max(1000, 'Post cannot exceed 1000 characters'),
  mediaUrl: z.string().url().nullable().optional(),
  createdAt: z.number(),
});

// Relationship validation
export const relationshipSchema = z.object({
  id: z.string().uuid(),
  followerId: z.string().uuid(),
  followedId: z.string().uuid(),
  createdAt: z.number(),
});

// For new user registration
export const createUserSchema = z.object({
  username: userSchema.shape.username,
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Password must contain at least one uppercase letter, one lowercase letter, and one number'),
});

// For creating new posts
export const createPostSchema = z.object({
  content: postSchema.shape.content,
  mediaUrl: postSchema.shape.mediaUrl,
});