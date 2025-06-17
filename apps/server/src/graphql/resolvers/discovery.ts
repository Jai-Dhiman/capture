import { and, desc, eq, inArray, notInArray, sql } from 'drizzle-orm';
import { createD1Client } from '../../db';
import * as schema from '../../db/schema';
import { QdrantClient, type QdrantSearchResult } from '../../lib/qdrantClient';
import { computeScore } from '../../lib/recommendation';
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

      // 2. Vector Search in Qdrant
      let vectorMatches: QdrantSearchResult[] = [];
      const vectorQueryLimit = limit * 10;
      try {
        vectorMatches = await qdrantClient.searchVectors({
          vector: userVector,
          limit: vectorQueryLimit,
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
      const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

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

      // 4. Filtering
      let followedUserIds: string[] = [];
      let blockedUserIds: string[] = [];
      try {
        const [followedUsersResult, blockedUsersResult] = await Promise.all([
          db
            .select({ followedId: schema.relationship.followedId })
            .from(schema.relationship)
            .where(eq(schema.relationship.followerId, userId)),
          db
            .select({ blockedId: schema.blockedUser.blockedId })
            .from(schema.blockedUser)
            .where(eq(schema.blockedUser.blockerId, userId)),
        ]);
        followedUserIds = followedUsersResult.map((r) => r.followedId);
        blockedUserIds = blockedUsersResult.map((r) => r.blockedId);
      } catch (e) {
        console.error(`Failed to fetch follow/block relationships for user ${userId}:`, e);
      }

      const filteredPosts = recommendedPosts.filter(
        (post) => !blockedUserIds.includes(post.userId),
      );

      // 4.b. Privacy Filtering — remove private-profile posts unless self or followed
      const privacyFilteredPosts = filteredPosts.filter((post) => {
        const isPrivate = !!post.author.isPrivate;
        if (!isPrivate) return true;
        return post.userId === userId || followedUserIds.includes(post.userId);
      });

      // 5. Ranking
      const rankedPosts = privacyFilteredPosts.sort((a, b) => {
        const aIsRecentFollowed =
          followedUserIds.includes(a.userId) && new Date(a.createdAt).getTime() >= oneWeekAgo;
        const bIsRecentFollowed =
          followedUserIds.includes(b.userId) && new Date(b.createdAt).getTime() >= oneWeekAgo;
        if (aIsRecentFollowed && !bIsRecentFollowed) return -1;
        if (!aIsRecentFollowed && bIsRecentFollowed) return 1;

        const simA = similarityScoreMap.get(a.id) ?? 0;
        const simB = similarityScoreMap.get(b.id) ?? 0;
        const scoreA = computeScore(simA, a._saveCount ?? 0, a._commentCount ?? 0);
        const scoreB = computeScore(simB, b._saveCount ?? 0, b._commentCount ?? 0);
        return scoreB - scoreA;
      });

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
