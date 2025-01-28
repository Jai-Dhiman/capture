import { z } from 'zod'

export const userSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
  emailVerified: z.boolean(),
  image: z.string().nullable().optional(),
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

export const postsSchema = z.object({
  id: z.string(),
  userId: z.string().nullable().optional(),
  content: z.string(),
  mediaUrl: z.string().nullable().optional(),
  createdAt: z.date(),
})

export const relationshipsSchema = z.object({
  id: z.string(),
  followerId: z.string().nullable().optional(),
  followedId: z.string().nullable().optional(),
  createdAt: z.date(),
})

export type User = z.infer<typeof userSchema>
export type Session = z.infer<typeof sessionSchema>
export type Account = z.infer<typeof accountSchema>
export type Verification = z.infer<typeof verificationSchema>
export type Post = z.infer<typeof postsSchema>
export type Relationship = z.infer<typeof relationshipsSchema>
