import { createD1Client } from '../db'
import { eq } from 'drizzle-orm'
import * as schema from '../db/schema'
import { nanoid } from 'nanoid'
import type { Bindings } from '../types'

export const resolvers = {
  Query: {
    async feed(_, { limit = 10, offset = 0 }, { bindings }: { bindings: Bindings }) {
      const db = createD1Client(bindings)
      const posts = await db.query.post.findMany({
        limit,
        offset,
        orderBy: (posts, { desc }) => [desc(posts.createdAt)],
        with: {
          user: true,
          media: true,
          comments: true,
          captags: true,
          savedBy: true,
        },
      })
      return posts
    },

    async post(_, { id }, { bindings }: { bindings: Bindings }) {
      const db = createD1Client(bindings)
      const post = await db.query.post.findFirst({
        where: (posts, { eq }) => eq(posts.id, id),
        with: {
          user: true,
          media: true,
          comments: true,
          captags: true,
          savedBy: true,
        },
      })

      if (!post) throw new Error('Post not found')
      return post
    },
  },

  Mutation: {
    async createPost(_, { input }, { bindings, user }: { bindings: Bindings; user: any }) {
      const db = createD1Client(bindings)

      return await db.transaction(async (tx) => {
        // Create the post
        const postId = nanoid()
        await tx.insert(schema.post).values({
          id: postId,
          userId: user.id,
          content: input.content,
          createdAt: new Date().toISOString(),
        })

        // Associate media if provided
        if (input.mediaIds?.length) {
          await Promise.all(
            input.mediaIds.map((mediaId: string) =>
              tx.update(schema.media).set({ postId }).where(eq(schema.media.id, mediaId))
            )
          )
        }

        // Associate captags if provided
        if (input.captagIds?.length) {
          await Promise.all(
            input.captagIds.map((captagId: string) =>
              tx.insert(schema.postCaptag).values({
                postId,
                captagId,
                createdAt: new Date().toISOString(),
              })
            )
          )
        }

        // Fetch the created post with all relations
        const post = await tx.query.post.findFirst({
          where: (posts, { eq }) => eq(posts.id, postId),
          with: {
            user: true,
            media: true,
            comments: true,
            captags: true,
            savedBy: true,
          },
        })

        if (!post) throw new Error('Failed to create post')
        return post
      })
    },
  },
}
