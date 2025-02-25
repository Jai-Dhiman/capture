import { createD1Client } from '../db'
import { eq } from 'drizzle-orm'
import * as schema from '../db/schema'
import { nanoid } from 'nanoid'
import { Bindings } from '../types'
import type { ContextType } from '../types'

export const resolvers = {
  Query: {
    async feed(_: unknown, { limit = 10, offset = 0 }, context: { env: any; user: any }) {
      if (!context.user) {
        throw new Error('Authentication required')
      }

      const db = createD1Client(context.env)
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

    async post(_parent: unknown, { id }: { id: string }, context: { env: any; user: any }) {
      if (!context.user) {
        throw new Error('Authentication required')
      }

      const db = createD1Client(context.env)
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
    async createPost(_parent: unknown, { input }: { input: any }, context: ContextType) {
      if (!context?.user) {
        throw new Error('Authentication required')
      }

      const db = createD1Client(context.env)

      try {
        const existingProfile = await db
          .select()
          .from(schema.profile)
          .where(eq(schema.profile.userId, context.user.id))
          .get()

        if (!existingProfile) {
          throw new Error('Profile not found.')
        }

        const postId = nanoid()

        await db.insert(schema.post).values({
          id: postId,
          userId: context.user.id,
          content: input.content,
          createdAt: new Date().toISOString(),
        })

        if (input.mediaIds?.length) {
          await Promise.all(
            input.mediaIds.map((mediaId: string) =>
              db.update(schema.media).set({ postId }).where(eq(schema.media.id, mediaId))
            )
          )
        }

        if (input.captagIds?.length) {
          await Promise.all(
            input.captagIds.map((captagId: string) =>
              db.insert(schema.postCaptag).values({
                postId,
                captagId,
                createdAt: new Date().toISOString(),
              })
            )
          )
        }

        const createdPost = await db
          .select({
            id: schema.post.id,
            content: schema.post.content,
            createdAt: schema.post.createdAt,
            userId: schema.post.userId,
          })
          .from(schema.post)
          .where(eq(schema.post.id, postId))
          .get()

        if (!createdPost) throw new Error('Failed to create post')

        const userProfile = await db
          .select()
          .from(schema.profile)
          .where(eq(schema.profile.userId, context.user.id))
          .get()

        if (!userProfile) throw new Error('User profile not found')

        let mediaItems: Array<any> = []
        if (input.mediaIds?.length) {
          mediaItems = await db
            .select()
            .from(schema.media)
            .where(eq(schema.media.postId, postId))
            .all()
        }

        return {
          ...createdPost,
          user: userProfile,
          media: mediaItems,
          comments: [],
          captags: [],
          savedBy: [],
        }
      } catch (error) {
        console.error('Creation error:', error)
        throw new Error(
          `Failed to create post: ${error instanceof Error ? error.message : 'Unknown error'}`
        )
      }
    },
  },
}
