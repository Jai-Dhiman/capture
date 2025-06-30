import { and, desc, eq, inArray, notInArray, sql, gt, lt } from 'drizzle-orm';
import { createD1Client } from '../../db';
import * as schema from '../../db/schema';
import { QdrantClient, type QdrantSearchResult } from '../../lib/qdrantClient';
import {
  calculateDiversityBonus,
  calculateEngagementRate,
  calculateTemporalRelevance,
  computeEnhancedScore,
  extractTopicsFromPost,
} from '../../lib/recommendation';
import { buildUserContext } from '../../lib/userContext';
import type { ContextType } from '../../types';

type GraphQLPostType = 'post' | 'thread';

interface GraphQLProfile {
  id: string;
  userId: string;
  username: string;
  profileImage?: string | null;
  verifiedType: string;
  isPrivate: boolean;
}

interface GraphQLPost {
  id: string;
  userId: string;
  content: string;
  type: GraphQLPostType;
  createdAt: string; // ISOString
  updatedAt: string; // ISOString
  _saveCount: number;
  _commentCount: number;
  user: GraphQLProfile;
  media: { id: string; type: string; storageKey: string; order: number; createdAt: string }[];
}

interface GraphQLFeedPayload {
  posts: GraphQLPost[];
  nextCursor?: string | null;
}

export const discoveryResolvers = {
  Query: {
    discoverFeed: async (
      _: unknown,
      { limit = 10, cursor }: { limit?: number; cursor?: string },
      context: ContextType,
    ): Promise<GraphQLFeedPayload> => {
      const { user, env } = context;

      if (!user) {
        throw new Error('Authentication required');
      }

      const db = createD1Client(env);
      const qdrantClient = new QdrantClient(env);
      const userId = user.id;
      const { USER_VECTORS } = env;

      if (!USER_VECTORS) {
        console.error('USER_VECTORS KV binding missing');
        throw new Error('Server configuration error: Bindings missing');
      }

      // 1. Get User Vector from KV
      let userVector: number[] | null = null;
      try {
        userVector = await USER_VECTORS.get<number[]>(userId, { type: 'json' });
      } catch (e) {
        console.error(`Failed to get user interest vector for ${userId}:`, e);
        return { posts: [], nextCursor: null };
      }

      if (!userVector) {
        return { posts: [], nextCursor: null };
      }

      // Fetch seen posts to exclude them from recommendations
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      let seenPostIds: string[] = [];
      try {
        seenPostIds = await db
          .select({ postId: schema.seenPostLog.postId })
          .from(schema.seenPostLog)
          .where(and(eq(schema.seenPostLog.userId, userId), gt(schema.seenPostLog.seenAt, thirtyDaysAgo)))
          .then((rows) => rows.map((r) => r.postId));

        // Periodically clean up old seen posts log (1% chance)
        if (Math.random() < 0.01) {
          const thirtyDaysAgoForCleanup = new Date(
            Date.now() - 30 * 24 * 60 * 60 * 1000,
          ).toISOString();
          await db
            .delete(schema.seenPostLog)
            .where(lt(schema.seenPostLog.seenAt, thirtyDaysAgoForCleanup));
          console.log('[discoverFeed] Cleaned up seen post logs older than 30 days.');
        }
      } catch (e) {
        console.error(`Failed to fetch seen posts for user ${userId}:`, e);
      }

      // Build user context for personalized scoring
      const userContext = await buildUserContext(userId, db);

      // Fetch blocked user IDs for filtering
      let blockedUserIds: string[] = [];
      try {
        const blockedUsersResult = await db
          .select({ blockedId: schema.blockedUser.blockedId })
          .from(schema.blockedUser)
          .where(eq(schema.blockedUser.blockerId, userId));
        blockedUserIds = blockedUsersResult.map((r) => r.blockedId);
      } catch (e) {
        console.error(`Failed to fetch block relationships for user ${userId}:`, e);
      }

      // 2. Vector Search in Qdrant
      let vectorMatches: QdrantSearchResult[] = [];
      const vectorQueryLimit = limit * 10;
      try {
        const filter: any = {
          must: [],
          should: [{ key: 'is_private', match: { value: false } }, { key: 'user_id', match: { value: userId } }],
        };

        if (blockedUserIds.length > 0) {
          filter.must.push({
            must_not: [{ key: 'user_id', match: { any: blockedUserIds } }],
          });
        }

        if (seenPostIds.length > 0) {
          filter.must.push({
            must_not: [{ key: 'original_id', match: { any: seenPostIds.map(id => `post:${id}`) } }],
          });
        }

        vectorMatches = await qdrantClient.searchVectors({
          vector: userVector,
          limit: vectorQueryLimit,
          filter,
        });
      } catch (e) {
        console.error(`Qdrant query failed for user ${userId}:`, e);
        throw new Error('Failed to query recommendations');
      }

      if (vectorMatches.length === 0) {
        return { posts: [], nextCursor: null };
      }

      const recommendedPostIds = vectorMatches.map((match) =>
        match.id.startsWith('post:') ? match.id.slice(5) : match.id,
      );
      const similarityScoreMap = new Map(
        vectorMatches.map((match) => [
          match.id.startsWith('post:') ? match.id.slice(5) : match.id,
          match.score,
        ]),
      );

      // 3. Fetch Post Details from D1
      let recommendedPosts: (typeof schema.post.$inferSelect & {
        author: typeof schema.profile.$inferSelect;
      })[] = [];
      try {
        recommendedPosts = await db
          .select({
            id: schema.post.id,
            userId: schema.post.userId,
            content: schema.post.content,
            type: schema.post.type,
            createdAt: schema.post.createdAt,
            _saveCount: schema.post._saveCount,
            _commentCount: schema.post._commentCount,
            author: schema.profile,
          })
          .from(schema.post)
          .innerJoin(schema.profile, eq(schema.post.userId, schema.profile.userId))
          .where(inArray(schema.post.id, recommendedPostIds))
          .orderBy(desc(schema.post.createdAt));
      } catch (e) {
        console.error(`Failed to fetch post details from D1 for user ${userId}:`, e);
        throw new Error('Failed to fetch post details');
      }

      // 5. Ranking with the new enhanced scoring model
      const rankedPosts = (
        await Promise.all(
          recommendedPosts.map(async (post) => {
            const similarity = similarityScoreMap.get(post.id) ?? 0;

            const engagementRate = calculateEngagementRate(
              post._saveCount ?? 0,
              post._commentCount ?? 0,
              post.createdAt,
            );

            const temporalRelevance = calculateTemporalRelevance(post.createdAt);

            // Fetch hashtags and media type for the post to calculate remaining signals
            const postDetails = await db.query.post.findFirst({
              where: eq(schema.post.id, post.id),
              with: {
                hashtags: { with: { hashtag: true } },
                media: { columns: { type: true } },
              },
            });

            const postHashtags = postDetails?.hashtags.map((h) => h.hashtag.name) ?? [];
            const postTopics = extractTopicsFromPost(post.content, postHashtags);
            const diversityBonus = calculateDiversityBonus(postTopics, userContext.recentTopics);

            const getContentType = (): 'text' | 'image' | 'video' | 'mixed' => {
              const mediaTypes = postDetails?.media.map((m) => m.type) ?? [];
              if (mediaTypes.length === 0) return 'text';
              if (mediaTypes.length > 1) return 'mixed';
              const type = mediaTypes[0];
              return type === 'image' || type === 'video' ? type : 'text';
            };

            const signals = {
              similarity,
              engagementRate,
              contentType: getContentType(),
              temporalRelevance,
              diversityBonus,
            };

            const score = computeEnhancedScore(signals, userContext);

            return { ...post, score };
          }),
        )
      ).sort((a, b) => b.score - a.score);

      // 6. Pagination (Cursor-based)
      const startIndex = cursor
        ? Math.max(rankedPosts.findIndex((p) => p.id === cursor) + 1, 0)
        : 0;
      const finalPosts = rankedPosts.slice(startIndex, startIndex + limit);
      const nextCursor =
        finalPosts.length === limit && startIndex + limit < rankedPosts.length
          ? finalPosts[finalPosts.length - 1].id
          : null;

      const formattedPosts: GraphQLPost[] = await Promise.all(
        finalPosts.map(async (p) => {
          const media = await db
            .select({
              id: schema.media.id,
              type: schema.media.type,
              storageKey: schema.media.storageKey,
              order: schema.media.order,
              createdAt: schema.media.createdAt,
            })
            .from(schema.media)
            .where(eq(schema.media.postId, p.id))
            .orderBy(schema.media.order);

          return {
            id: p.id,
            userId: p.userId,
            content: p.content,
            type: p.type as GraphQLPostType,
            createdAt: p.createdAt,
            updatedAt: p.createdAt,
            _saveCount: p._saveCount,
            _commentCount: p._commentCount,
            user: {
              id: p.author.id,
              userId: p.author.userId,
              username: p.author.username,
              profileImage: p.author.profileImage,
              verifiedType: p.author.verifiedType ?? 'none',
              isPrivate: !!p.author.isPrivate,
            },
            media,
          };
        }),
      );

      const response: GraphQLFeedPayload = {
        posts: formattedPosts,
        nextCursor,
      };

      return response;
    },
  },
};
