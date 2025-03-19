import { createD1Client } from '../../db'
import { eq, desc, like, asc, count } from 'drizzle-orm'
import * as schema from '../../db/schema'
import { nanoid } from 'nanoid'
import type { ContextType } from '../../types'

export const commentResolvers = {
  Query: {
    async commentConnection(
      _: unknown,
      {
        postId,
        parentPath = null,
        sortBy = 'newest',
        page = 1,
        limit = 10,
      }: {
        postId: string
        parentPath?: string | null
        sortBy?: 'newest' | 'oldest'
        page?: number
        limit?: number
      },
      context: ContextType
    ) {
      if (!context.user) {
        throw new Error('Authentication required')
      }

      const db = createD1Client(context.env)
      const offset = (page - 1) * limit

      try {
        // Check if post exists
        const post = await db.select().from(schema.post).where(eq(schema.post.id, postId)).get()

        if (!post) {
          throw new Error('Post not found')
        }

        // Query for comments with specified filters
        let query = db.select().from(schema.comment).where(eq(schema.comment.postId, postId))

        if (parentPath) {
          // Get direct children of a specific comment path
          query = query.where(like(schema.comment.path, `${parentPath}.%`))
        } else {
          // Get top-level comments only (depth 0)
          query = query.where(eq(schema.comment.depth, 0))
        }

        // Apply sorting
        if (sortBy === 'newest') {
          query = query.orderBy(desc(schema.comment.createdAt))
        } else {
          query = query.orderBy(asc(schema.comment.createdAt))
        }

        // Count total matching comments for pagination
        const countQuery = db
          .select({ count: count() })
          .from(schema.comment)
          .where(eq(schema.comment.postId, postId))

        if (parentPath) {
          countQuery.where(like(schema.comment.path, `${parentPath}.%`))
        } else {
          countQuery.where(eq(schema.comment.depth, 0))
        }

        const totalCountResult = await countQuery.get()
        const totalCount = totalCountResult?.count || R.count

        const comments = await query.limit(limit).offset(offset).all()

        return {
          comments,
          totalCount,
          hasNextPage: offset + comments.length < totalCount,
        }
      } catch (error) {
        console.error('Error fetching comments:', error)
        throw new Error(
          `Failed to fetch comments: ${error instanceof Error ? error.message : 'Unknown error'}`
        )
      }
    },

    async comment(_: unknown, { id }: { id: string }, context: ContextType) {
      if (!context.user) {
        throw new Error('Authentication required')
      }

      const db = createD1Client(context.env)

      try {
        const comment = await db
          .select()
          .from(schema.comment)
          .where(eq(schema.comment.id, id))
          .get()

        if (!comment) {
          throw new Error('Comment not found')
        }

        return comment
      } catch (error) {
        console.error('Error fetching comment:', error)
        throw new Error(
          `Failed to fetch comment: ${error instanceof Error ? error.message : 'Unknown error'}`
        )
      }
    },
  },

  Mutation: {
    async createComment(
      _: unknown,
      {
        input,
      }: {
        input: {
          postId: string
          content: string
          parentPath?: string | null
        }
      },
      context: ContextType
    ) {
      if (!context.user) {
        throw new Error('Authentication required')
      }

      const db = createD1Client(context.env)

      try {
        const post = await db
          .select()
          .from(schema.post)
          .where(eq(schema.post.id, input.postId))
          .get()

        if (!post) {
          throw new Error('Post not found')
        }

        let newPath: string
        let depth: number = 0

        if (input.parentPath) {
          const parentComment = await db
            .select()
            .from(schema.comment)
            .where(
              and(
                eq(schema.comment.path, input.parentPath),
                eq(schema.comment.postId, input.postId)
              )
            )
            .get()

          if (!parentComment) {
            throw new Error('Parent comment not found')
          }

          const siblings = await db
            .select()
            .from(schema.comment)
            .where(like(schema.comment.path, `${input.parentPath}.%`))
            .where(eq(schema.comment.depth, parentComment.depth + 1))
            .all()

          const siblingPaths = siblings.map((s) => s.path)
          const childIndices = siblingPaths.map((path) => {
            const lastSegment = path.split('.').pop()
            return parseInt(lastSegment || '0', 10)
          })

          const nextIndex = childIndices.length > 0 ? Math.max(...childIndices) + 1 : 1
          newPath = `${input.parentPath}.${nextIndex.toString().padStart(2, '0')}`
          depth = parentComment.depth + 1
        } else {
          const topLevelComments = await db
            .select()
            .from(schema.comment)
            .where(and(eq(schema.comment.postId, input.postId), eq(schema.comment.depth, 0)))
            .all()

          const topLevelIndices = topLevelComments.map((c) => {
            return parseInt(c.path, 10)
          })

          const nextIndex = topLevelIndices.length > 0 ? Math.max(...topLevelIndices) + 1 : 1
          newPath = nextIndex.toString().padStart(2, '0')
          depth = 0
        }

        const commentId = nanoid()

        await db.insert(schema.comment).values({
          id: commentId,
          postId: input.postId,
          userId: context.user.id,
          content: input.content,
          path: newPath,
          depth,
          createdAt: new Date().toISOString(),
        })

        const createdComment = await db
          .select()
          .from(schema.comment)
          .where(eq(schema.comment.id, commentId))
          .get()

        if (!createdComment) {
          throw new Error('Failed to create comment')
        }

        return createdComment
      } catch (error) {
        console.error('Error creating comment:', error)
        throw new Error(
          `Failed to create comment: ${error instanceof Error ? error.message : 'Unknown error'}`
        )
      }
    },

    async deleteComment(_: unknown, { id }: { id: string }, context: ContextType) {
      if (!context.user) {
        throw new Error('Authentication required')
      }

      const db = createD1Client(context.env)

      try {
        const comment = await db
          .select()
          .from(schema.comment)
          .where(eq(schema.comment.id, id))
          .get()

        if (!comment) {
          throw new Error('Comment not found')
        }

        if (comment.userId !== context.user.id) {
          throw new Error('Not authorized to delete this comment')
        }

        await db
          .delete(schema.comment)
          .where(like(schema.comment.path, `${comment.path}.%`))
          .execute()

        await db.delete(schema.comment).where(eq(schema.comment.id, id)).execute()

        return {
          id,
          success: true,
        }
      } catch (error) {
        console.error('Error deleting comment:', error)
        throw new Error(
          `Failed to delete comment: ${error instanceof Error ? error.message : 'Unknown error'}`
        )
      }
    },
  },

  Comment: {
    async user(parent: { userId: string }, _: unknown, context: ContextType) {
      const db = createD1Client(context.env)

      const profile = await db
        .select()
        .from(schema.profile)
        .where(eq(schema.profile.userId, parent.userId))
        .get()

      return profile
    },

    async post(parent: { postId: string }, _: unknown, context: ContextType) {
      const db = createD1Client(context.env)

      const post = await db
        .select()
        .from(schema.post)
        .where(eq(schema.post.id, parent.postId))
        .get()

      return post
    },
  },
}
