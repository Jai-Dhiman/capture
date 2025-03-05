import { createD1Client } from '../../db'
import { eq, desc, and, isNull, asc } from 'drizzle-orm'
import * as schema from '../../db/schema'
import { nanoid } from 'nanoid'
import type { ContextType } from '../../types'

export const commentResolvers = {
  Query: {
    async comments(
      _: unknown,
      {
        postId,
        parentCommentId = null,
        limit = 10,
        offset = 0,
        sortBy = 'newest',
      }: {
        postId: string
        parentCommentId?: string | null
        limit?: number
        offset?: number
        sortBy?: 'newest' | 'oldest'
      },
      context: ContextType
    ) {
      if (!context.user) {
        throw new Error('Authentication required')
      }

      const db = createD1Client(context.env)

      try {
        // Check if post exists
        const post = await db.select().from(schema.post).where(eq(schema.post.id, postId)).get()

        if (!post) {
          throw new Error('Post not found')
        }

        // Query for comments with specified filters
        const query = db
          .select()
          .from(schema.comment)
          .where(
            and(
              eq(schema.comment.postId, postId),
              parentCommentId
                ? eq(schema.comment.parentCommentId, parentCommentId)
                : isNull(schema.comment.parentCommentId)
            )
          )
          .limit(limit)
          .offset(offset)

        // Apply sorting
        if (sortBy === 'newest') {
          query.orderBy(desc(schema.comment.createdAt))
        } else {
          query.orderBy(asc(schema.comment.createdAt))
        }

        const comments = await query.all()

        return comments
      } catch (error) {
        console.error('Error fetching comments:', error)
        throw new Error(
          `Failed to fetch comments: ${error instanceof Error ? error.message : 'Unknown error'}`
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
          parentCommentId?: string
        }
      },
      context: ContextType
    ) {
      if (!context.user) {
        throw new Error('Authentication required')
      }

      const db = createD1Client(context.env)

      try {
        // Validate post exists
        const post = await db
          .select()
          .from(schema.post)
          .where(eq(schema.post.id, input.postId))
          .get()

        if (!post) {
          throw new Error('Post not found')
        }

        // Validate parent comment if provided
        if (input.parentCommentId) {
          const parentComment = await db
            .select()
            .from(schema.comment)
            .where(eq(schema.comment.id, input.parentCommentId))
            .get()

          if (!parentComment) {
            throw new Error('Parent comment not found')
          }

          // Prevent deeply nested comments (only one level of nesting)
          if (parentComment.parentCommentId) {
            throw new Error('Cannot reply to a reply. Only one level of nesting is supported.')
          }
        }

        // Create comment
        const commentId = nanoid()

        await db.insert(schema.comment).values({
          id: commentId,
          postId: input.postId,
          userId: context.user.id,
          content: input.content,
          parentCommentId: input.parentCommentId || null,
          createdAt: new Date().toISOString(),
        })

        // Fetch the created comment with relations
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
        // Check if comment exists and belongs to user
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

        // Delete all replies to this comment first
        await db.delete(schema.comment).where(eq(schema.comment.parentCommentId, id)).execute()

        // Delete the comment
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

    async replies(parent: { id: string }, _: unknown, context: ContextType) {
      const db = createD1Client(context.env)

      const replies = await db
        .select()
        .from(schema.comment)
        .where(eq(schema.comment.parentCommentId, parent.id))
        .orderBy(desc(schema.comment.createdAt))
        .all()

      return replies
    },

    async parentComment(
      parent: { parentCommentId?: string | null },
      _: unknown,
      context: ContextType
    ) {
      if (!parent.parentCommentId) return null

      const db = createD1Client(context.env)

      const parentComment = await db
        .select()
        .from(schema.comment)
        .where(eq(schema.comment.id, parent.parentCommentId))
        .get()

      return parentComment
    },
  },
}
