import { z } from 'zod'

export const userSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
  emailVerified: z.boolean(),
  image: z.string().nullable().optional(),
  bio: z.string().nullable().optional(),
  mediaVerified: z.boolean().default(false),
  createdAt: z.date(),
  updatedAt: z.date(),
})

export const sessionSchema = z.object({
  id: z.string(),
  expiresAt: z.date(),
  token: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
  ipAddress: z.string().nullable().optional(),
  userAgent: z.string().nullable().optional(),
  userId: z.string(),
})

export const accountSchema = z.object({
  id: z.string(),
  accountId: z.string(),
  providerId: z.string(),
  userId: z.string(),
  accessToken: z.string().nullable().optional(),
  refreshToken: z.string().nullable().optional(),
  idToken: z.string().nullable().optional(),
  accessTokenExpiresAt: z.date().nullable().optional(),
  refreshTokenExpiresAt: z.date().nullable().optional(),
  scope: z.string().nullable().optional(),
  password: z.string().nullable().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
})

export const verificationSchema = z.object({
  id: z.string(),
  identifier: z.string(),
  value: z.string(),
  expiresAt: z.date(),
  createdAt: z.date().nullable().optional(),
  updatedAt: z.date().nullable().optional(),
})

export const postSchema = z.object({
  id: z.string(),
  userId: z.string().nullable().optional(),
  content: z.string(),
  createdAt: z.date(),
})

export const mediaSchema = z.object({
  id: z.string(),
  postId: z.string().nullable().optional(),
  type: z.string(),
  url: z.string(),
  thumbnailUrl: z.string().nullable().optional(),
  order: z.number(),
  createdAt: z.date(),
})

export const commentSchema = z.object({
  id: z.string(),
  postId: z.string().nullable().optional(),
  userId: z.string().nullable().optional(),
  content: z.string(),
  parentCommentId: z.string().nullable().optional(),
  createdAt: z.date(),
})

export const savedPostSchema = z.object({
  id: z.string(),
  userId: z.string().nullable().optional(),
  postId: z.string().nullable().optional(),
  createdAt: z.date(),
})

export const captagSchema = z.object({
  id: z.string(),
  name: z.string(),
  createdAt: z.date(),
})

export const postCaptagSchema = z.object({
  postId: z.string().nullable().optional(),
  captagId: z.string().nullable().optional(),
  createdAt: z.date(),
})

export const relationshipSchema = z.object({
  id: z.string(),
  followerId: z.string().nullable().optional(),
  followedId: z.string().nullable().optional(),
  createdAt: z.date(),
})

export type User = z.infer<typeof userSchema>
export type Session = z.infer<typeof sessionSchema>
export type Account = z.infer<typeof accountSchema>
export type Verification = z.infer<typeof verificationSchema>
export type Post = z.infer<typeof postSchema>
export type Media = z.infer<typeof mediaSchema>
export type Comment = z.infer<typeof commentSchema>
export type SavedPost = z.infer<typeof savedPostSchema>
export type Captag = z.infer<typeof captagSchema>
export type PostCaptag = z.infer<typeof postCaptagSchema>
export type Relationship = z.infer<typeof relationshipSchema>
