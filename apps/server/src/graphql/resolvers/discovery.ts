import { eq, desc, and, inArray, notInArray, sql } from 'drizzle-orm';
import * as schema from '../../db/schema';
import type { ContextType } from '../../types';
import { createD1Client } from '../../db';
import { computeScore } from '../../lib/recommendation';

type VectorizeMatch = {
  id: string;
  score: number;
};

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
  author: GraphQLProfile;
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
      const userId = user.id;
      const { USER_VECTORS, VECTORIZE } = env;

      if (!USER_VECTORS || !VECTORIZE) {
        console.error('USER_VECTORS KV or VECTORIZE binding missing');
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
        console.log(`No interest vector found for user ${userId}. Returning empty discovery feed.`);
        return { posts: [], nextCursor: null };
      }

      // 2. Vector Search in Vectorize
      let vectorMatches: VectorizeMatch[] = [];
      const vectorQueryLimit = limit * 3;
      try {
        const queryResult = await VECTORIZE.query(userVector, { topK: vectorQueryLimit });
        vectorMatches = queryResult.matches as VectorizeMatch[];
        console.log(`Vectorize found ${vectorMatches.length} matches for user ${userId}`);
      } catch (e) {
        console.error(`Vectorize query failed for user ${userId}:`, e);
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

        console.log(`Fetched ${recommendedPosts.length} post details from D1 for user ${userId}`);
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
        console.log(
          `User ${userId} follows ${followedUserIds.length} users and blocks ${blockedUserIds.length} users.`,
        );
      } catch (e) {
        console.error(`Failed to fetch follow/block relationships for user ${userId}:`, e);
      }

      const filteredPosts = recommendedPosts.filter(
        (post) => !blockedUserIds.includes(post.userId),
      );
      console.log(
        `Filtered down to ${filteredPosts.length} posts after removing blocked authors for user ${userId}`,
      );

      // 4.b. Privacy Filtering — remove private-profile posts unless self or followed
      const privacyFilteredPosts = filteredPosts.filter((post) => {
        const isPrivate = !!post.author.isPrivate;
        if (!isPrivate) return true;
        return post.userId === userId || followedUserIds.includes(post.userId);
      });
      console.log(
        `Filtered down to ${privacyFilteredPosts.length} posts after applying privacy rules for user ${userId}`,
      );

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
      const nextCursor = finalPosts.length === limit ? finalPosts[finalPosts.length - 1].id : null;

      const formattedPosts: GraphQLPost[] = finalPosts.map((p) => ({
        id: p.id,
        userId: p.userId,
        content: p.content,
        type: p.type as GraphQLPostType,
        createdAt: p.createdAt,
        updatedAt: p.createdAt,
        _saveCount: p._saveCount,
        _commentCount: p._commentCount,
        author: {
          id: p.author.id,
          userId: p.author.userId,
          username: p.author.username,
          profileImage: p.author.profileImage,
          verifiedType: p.author.verifiedType ?? 'none',
          isPrivate: !!p.author.isPrivate,
        },
      }));

      const response: GraphQLFeedPayload = {
        posts: formattedPosts,
        nextCursor,
      };

      return response;
    },
  },
};
