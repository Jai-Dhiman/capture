import { z } from 'zod'
// User Schema
export const userSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1, 'Name cannot be empty'),
  email: z.string().email('Invalid email format'),
  emailVerified: z.boolean(),
  image: z.string().url().nullable().optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
})

// Session Schema
export const sessionSchema = z.object({
  id: z.string().uuid(),
  expiresAt: z.number(),
  token: z.string().min(1, 'Token cannot be empty'),
  createdAt: z.number(),
  updatedAt: z.number(),
  ipAddress: z.string().ip().optional(),
  userAgent: z.string().optional(),
  userId: z.string().uuid(),
})

// Account Schema
export const accountSchema = z.object({
  id: z.string().uuid(),
  accountId: z.string().min(1, 'Account ID cannot be empty'),
  providerId: z.string().min(1, 'Provider ID cannot be empty'),
  userId: z.string().uuid(),
  accessToken: z.string().optional(),
  refreshToken: z.string().optional(),
  idToken: z.string().optional(),
  accessTokenExpiresAt: z.number().optional(),
  refreshTokenExpiresAt: z.number().optional(),
  scope: z.string().optional(),
  password: z.string().optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
})

// Verification Schema
export const verificationSchema = z.object({
  id: z.string().uuid(),
  identifier: z.string().min(1, 'Identifier cannot be empty'),
  value: z.string().min(1, 'Value cannot be empty'),
  expiresAt: z.number(),
  createdAt: z.number().optional(),
  updatedAt: z.number().optional(),
})

// Posts Schema
export const postSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid().optional(),
  content: z
    .string()
    .min(1, 'Post cannot be empty')
    .max(1000, 'Post cannot exceed 1000 characters'),
  mediaUrl: z.string().url().optional(),
  createdAt: z.number(),
})

// Relationships Schema
export const relationshipSchema = z.object({
  id: z.string().uuid(),
  followerId: z.string().uuid(),
  followedId: z.string().uuid(),
  createdAt: z.number(),
})

// Create schemas for input validation
export const createUserSchema = z.object({
  name: userSchema.shape.name,
  email: userSchema.shape.email,
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      'Password must contain at least one uppercase letter, one lowercase letter, and one number'
    ),
})

export const createPostSchema = z.object({
  content: postSchema.shape.content,
  mediaUrl: postSchema.shape.mediaUrl,
})
