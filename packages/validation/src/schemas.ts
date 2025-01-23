import { z } from "zod";

// User schemas
export const userSchema = z.object({
  id: z.string(),
  username: z.string().min(3).max(20),
  email: z.string().email(),
  createdAt: z.string().datetime(),
});

export type User = z.infer<typeof userSchema>;

// Post schemas
export const postSchema = z.object({
  id: z.string(),
  userId: z.string(),
  content: z.string().max(2000),
  createdAt: z.string().datetime(),
});

export type Post = z.infer<typeof postSchema>;
