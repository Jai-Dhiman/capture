import { createD1Client } from '../../db'
import { eq, inArray } from 'drizzle-orm'
import * as schema from '../../db/schema'

export const profileResolvers = {
  Query: {
    async profile(_: unknown, { id }: { id: string }, context: { env: any; user: any }) {
      if (!context.user) {
        throw new Error('Authentication required')
      }

      const db = createD1Client(context.env)

      const profile = await db
        .select()
        .from(schema.profile)
        .where(eq(schema.profile.userId, id))
        .get()

      if (!profile) throw new Error('Profile not found')

      const posts = await db
        .select({
          id: schema.post.id,
          content: schema.post.content,
          createdAt: schema.post.createdAt,
          userId: schema.post.userId,
        })
        .from(schema.post)
        .where(eq(schema.post.userId, id))
        .all()

      const mediaItems =
        posts.length > 0
          ? await db
              .select({
                id: schema.media.id,
                postId: schema.media.postId,
                storageKey: schema.media.storageKey,
                type: schema.media.type,
                order: schema.media.order,
              })
              .from(schema.media)
              .where(
                inArray(
                  schema.media.postId,
                  posts.map((post) => post.id)
                )
              )
              .all()
          : []

      const postsWithMedia = posts.map((post) => ({
        ...post,
        media: mediaItems.filter((media) => media.postId === post.id),
      }))

      return {
        ...profile,
        posts: postsWithMedia,
      }
    },
  },
}
