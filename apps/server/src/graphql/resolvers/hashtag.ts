import { eq, like } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { createD1Client } from '../../db';
import * as schema from '../../db/schema';
import type { ContextType } from '../../types';

export const hashtagResolvers = {
  Query: {
    async searchHashtags(
      _: unknown,
      { query, limit = 10, offset = 0 }: { query: string; limit?: number; offset?: number },
      context: ContextType,
    ) {
      if (!context.user) {
        throw new Error('Authentication required');
      }

      const db = createD1Client(context.env);

      const hashtags = await db
        .select()
        .from(schema.hashtag)
        .where(like(schema.hashtag.name, `%${query}%`))
        .limit(limit)
        .offset(offset)
        .all();

      return hashtags;
    },
  },

  Mutation: {
    async createHashtag(_: unknown, { name }: { name: string }, context: ContextType) {
      if (!context.user) {
        throw new Error('Authentication required');
      }

      if (!name || name.trim() === '') {
        throw new Error('Hashtag name cannot be empty');
      }

      const cleanName = name.startsWith('#') ? name.substring(1) : name;

      const db = createD1Client(context.env);

      const existingHashtag = await db
        .select()
        .from(schema.hashtag)
        .where(eq(schema.hashtag.name, cleanName))
        .get();

      if (existingHashtag) {
        return existingHashtag;
      }

      const hashtagId = nanoid();
      await db.insert(schema.hashtag).values({
        id: hashtagId,
        name: cleanName,
        createdAt: new Date().toISOString(),
      });

      const createdHashtag = await db
        .select()
        .from(schema.hashtag)
        .where(eq(schema.hashtag.id, hashtagId))
        .get();

      if (!createdHashtag) {
        throw new Error('Failed to create hashtag');
      }

      return createdHashtag;
    },
  },

  Hashtag: {
    async posts(parent: { id: string }, _: unknown, context: ContextType) {
      const db = createD1Client(context.env);

      const postHashtags = await db
        .select({
          postId: schema.postHashtag.postId,
        })
        .from(schema.postHashtag)
        .where(eq(schema.postHashtag.hashtagId, parent.id))
        .all();

      if (postHashtags.length === 0) {
        return [];
      }

      const postIds = postHashtags.map((pc) => pc.postId);

      const posts = await db.query.post.findMany({
        where: (posts, { inArray }) => {
          const validPostIds = postIds.filter((id): id is string => id !== null);
          return inArray(posts.id, validPostIds);
        },
        with: {
          user: true,
          media: true,
        },
      });

      return posts;
    },
  },
};
