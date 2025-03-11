import { z } from 'zod'

export const profileSchema = z.object({
  id: z.string(),
  userId: z.string(),
  username: z.string(),
  profileImage: z.string().nullable().optional(),
  bio: z.string().nullable().optional(),
  verifiedType: z.string().default('none'),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export const postSchema = z.object({
  id: z.string(),
  userId: z.string().nullable().optional(),
  content: z.string(),
  createdAt: z.string(),
})

export const mediaSchema = z.object({
  id: z.string(),
  userId: z.string().nullable().optional(),
  postId: z.string().nullable().optional(),
  type: z.string(),
  storageKey: z.string(),
  order: z.number(),
  createdAt: z.string(),
})

export const commentSchema = z.object({
  id: z.string(),
  postId: z.string().nullable().optional(),
  userId: z.string().nullable().optional(),
  content: z.string(),
  parentCommentId: z.string().nullable().optional(),
  createdAt: z.string(),
})

export const savedPostSchema = z.object({
  id: z.string(),
  userId: z.string().nullable().optional(),
  postId: z.string().nullable().optional(),
  createdAt: z.string(),
})

export const hashtagSchema = z.object({
  id: z.string(),
  name: z.string(),
  createdAt: z.string(),
})

export const postHashtagSchema = z.object({
  postId: z.string().nullable().optional(),
  hashtagId: z.string().nullable().optional(),
  createdAt: z.string(),
})

export const relationshipSchema = z.object({
  id: z.string(),
  followerId: z.string().nullable().optional(),
  followedId: z.string().nullable().optional(),
  createdAt: z.string(),
})

export type Profile = z.infer<typeof profileSchema>
export type Post = z.infer<typeof postSchema>
export type Media = z.infer<typeof mediaSchema>
export type Comment = z.infer<typeof commentSchema>
export type SavedPost = z.infer<typeof savedPostSchema>
export type Hashtag = z.infer<typeof hashtagSchema>
export type PostHashtag = z.infer<typeof postHashtagSchema>
export type Relationship = z.infer<typeof relationshipSchema>
