import { z } from 'zod'

export const profileSchema = z.object({
  id: z.string(),
  username: z.string(),
  email: z.string().email(),
  phoneNumber: z.string().nullable().optional(),
  image: z.string().nullable().optional(),
  bio: z.string().nullable().optional(),
  verifiedType: z.string().default('none'),
  createdAt: z.date(),
  updatedAt: z.date(),
})

export const postSchema = z.object({
  id: z.string(),
  userId: z.string().nullable().optional(),
  content: z.string(),
  createdAt: z.date(),
})

export const mediaSchema = z.object({
  id: z.string(),
  userId: z.string().nullable().optional(),
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

export type Profile = z.infer<typeof profileSchema>
export type Post = z.infer<typeof postSchema>
export type Media = z.infer<typeof mediaSchema>
export type Comment = z.infer<typeof commentSchema>
export type SavedPost = z.infer<typeof savedPostSchema>
export type Captag = z.infer<typeof captagSchema>
export type PostCaptag = z.infer<typeof postCaptagSchema>
export type Relationship = z.infer<typeof relationshipSchema>
