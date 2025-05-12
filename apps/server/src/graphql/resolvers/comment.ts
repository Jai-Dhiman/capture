import { createD1Client } from "../../db";
import { eq, desc, asc, count, or, gt, and, lt, isNull, SQL, sql } from "drizzle-orm";
import * as schema from "../../db/schema";
import { nanoid } from "nanoid";
import type { ContextType } from "../../types";

export const commentResolvers = {
  Query: {
    async commentConnection(
      _: unknown,
      {
        postId,
        parentId = null,
        sortBy = "newest",
        cursor = null,
        limit = 10,
      }: {
        postId: string;
        parentId?: string | null;
        sortBy?: "newest" | "oldest";
        cursor?: string | null;
        limit?: number;
      },
      context: ContextType
    ) {
      if (!context.user) {
        throw new Error("Authentication required");
      }

      const db = createD1Client(context.env);

      try {
        const post = await db.select().from(schema.post).where(eq(schema.post.id, postId)).get();

        if (!post) {
          throw new Error("Post not found");
        }

        const conditions: SQL<unknown>[] = [eq(schema.comment.postId, postId)];

        if (parentId === null) {
          conditions.push(isNull(schema.comment.parentId));
        } else {
          conditions.push(eq(schema.comment.parentId, parentId));
        }

        const baseQuery = db.select().from(schema.comment);

        if (cursor) {
          const decodedCursor = Buffer.from(cursor, "base64").toString("utf-8");
          const [cursorTimestamp, cursorId] = decodedCursor.split("::");

          const cursorConditions =
            sortBy === "newest"
              ? or(
                  lt(schema.comment.createdAt, cursorTimestamp),
                  and(eq(schema.comment.createdAt, cursorTimestamp), lt(schema.comment.id, cursorId))
                )
              : or(
                  gt(schema.comment.createdAt, cursorTimestamp),
                  and(eq(schema.comment.createdAt, cursorTimestamp), gt(schema.comment.id, cursorId))
                );
          conditions.push(cursorConditions as SQL<unknown>);
        }

        const query = baseQuery
          .where(sql`${and(...conditions)}`)
          .orderBy(sortBy === "newest" ? desc(schema.comment.createdAt) : asc(schema.comment.createdAt));

        const countQuery = db
          .select({ count: count() })
          .from(schema.comment)
          .where(and(...conditions));

        const totalCountResult = await countQuery.get();
        const totalCount = totalCountResult?.count || 0;

        const comments = await query.limit(limit + 1).all();

        const hasNextPage = comments.length > limit;
        const limitedComments = hasNextPage ? comments.slice(0, limit) : comments;

        let nextCursor = null;
        if (hasNextPage && limitedComments.length > 0) {
          const lastItem = limitedComments[limitedComments.length - 1];
          nextCursor = Buffer.from(`${lastItem.createdAt}::${lastItem.id}`).toString("base64");
        }

        return {
          comments: limitedComments,
          totalCount,
          hasNextPage,
          nextCursor,
        };
      } catch (error) {
        console.error("Error fetching comments:", error);
        throw new Error(`Failed to fetch comments: ${error instanceof Error ? error.message : "Unknown error"}`);
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
          postId: string;
          content: string;
          parentId?: string | null;
        };
      },
      context: ContextType
    ) {
      if (!context.user) {
        throw new Error("Authentication required");
      }

      const db = createD1Client(context.env);

      try {
        const post = await db.select().from(schema.post).where(eq(schema.post.id, input.postId)).get();

        if (!post) {
          throw new Error("Post not found");
        }

        let newPath: string;
        let depth: number = 0;

        if (input.parentId) {
          const parentComment = await db
            .select()
            .from(schema.comment)
            .where(eq(schema.comment.id, input.parentId))
            .get();

          if (!parentComment) {
            throw new Error("Parent comment not found");
          }

          const siblings = await db
            .select()
            .from(schema.comment)
            .where(
              sql`${schema.comment.parentId} = ${input.parentId} AND ${schema.comment.depth} = ${
                parentComment.depth + 1
              }`
            )
            .all();

          const siblingCount = siblings.length;
          const nextIndex = siblingCount + 1;
          newPath = `${parentComment.path}.${nextIndex.toString().padStart(2, "0")}`;
          depth = parentComment.depth + 1;
        } else {
          const topLevelComments = await db
            .select()
            .from(schema.comment)
            .where(and(eq(schema.comment.postId, input.postId), eq(schema.comment.depth, 0)))
            .all();

          const topLevelIndices = topLevelComments.map((c) => {
            return parseInt(c.path, 10);
          });

          const nextIndex = topLevelIndices.length > 0 ? Math.max(...topLevelIndices) + 1 : 1;
          newPath = nextIndex.toString().padStart(2, "0");
          depth = 0;
        }

        const commentId = nanoid();

        await db.insert(schema.comment).values({
          id: commentId,
          postId: input.postId,
          userId: context.user.id,
          content: input.content,
          parentId: input.parentId || null,
          path: newPath,
          depth,
          createdAt: new Date().toISOString(),
        });

        await db
          .update(schema.post)
          .set({ _commentCount: sql`${schema.post._commentCount} + 1` })
          .where(eq(schema.post.id, input.postId));

        const createdComment = await db.select().from(schema.comment).where(eq(schema.comment.id, commentId)).get();

        if (!createdComment) {
          throw new Error("Failed to create comment");
        }

        return createdComment;
      } catch (error) {
        console.error("Error creating comment:", error);
        throw new Error(`Failed to create comment: ${error instanceof Error ? error.message : "Unknown error"}`);
      }
    },

    async deleteComment(_: unknown, { id }: { id: string }, context: ContextType) {
      if (!context.user) {
        throw new Error("Authentication required");
      }

      const db = createD1Client(context.env);

      try {
        const comment = await db.select().from(schema.comment).where(eq(schema.comment.id, id)).get();

        if (!comment) {
          throw new Error("Comment not found");
        }

        if (comment.userId !== context.user.id) {
          throw new Error("Not authorized to delete this comment");
        }

        await db
          .update(schema.comment)
          .set({ content: "[Comment deleted]", isDeleted: 1 })
          .where(eq(schema.comment.id, id))
          .execute();

        return {
          id,
          success: true,
        };
      } catch (error) {
        console.error("Error deleting comment:", error);
        throw new Error(`Failed to delete comment: ${error instanceof Error ? error.message : "Unknown error"}`);
      }
    },
  },

  Comment: {
    async user(parent: { userId: string }, _: unknown, context: ContextType) {
      const db = createD1Client(context.env);

      const profile = await db.select().from(schema.profile).where(eq(schema.profile.userId, parent.userId)).get();

      return profile;
    },

    async post(parent: { postId: string }, _: unknown, context: ContextType) {
      const db = createD1Client(context.env);

      const post = await db.select().from(schema.post).where(eq(schema.post.id, parent.postId)).get();

      return post;
    },
  },
};
