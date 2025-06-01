// Test file for comment resolver - Query.commentConnection
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createGraphQLTestClient, type GraphQLTestClient } from '../../../../test/utils/graphql-test-client';
import { posts as postsTable, comments as commentsTable, users as usersTable } from '@/server/db/schema';
import { type User, type Post, type Comment } from '@prisma/client';
import { encodeCursor, decodeCursor } from '@/server/utils/cursor';

const COMMENT_CONNECTION_QUERY = `
  query CommentConnection( $postId: ID!, $parentId: ID, $limit: Int, $sortBy: CommentSortBy, $cursor: String ) {
    commentConnection( postId: $postId, parentId: $parentId, limit: $limit, sortBy: $sortBy, cursor: $cursor ) {
      comments { id content createdAt userId postId parentId }
      totalCount hasNextPage nextCursor
    }
  }
`;
type MockUserEntry = Omit<User, 'createdAt' | 'updatedAt' | 'emailVerified'> & { createdAt?: Date, updatedAt?: Date, emailVerified?: Date | null };
type MockPostEntry = Omit<Post, 'createdAt' | 'updatedAt'> & { createdAt?: Date, updatedAt?: Date };
type MockCommentEntry = Omit<Comment, 'updatedAt'> & { updatedAt?: Date };

const baseTime = new Date('2024-01-01T00:00:00.000Z').getTime();
const createCommentData = (id: string, userId: string, postId: string, content: string, parentId: string | null = null, timestampOffsetMs: number = 0): MockCommentEntry => {
    const createdAt = new Date(baseTime + timestampOffsetMs);
    return { id, userId, postId, content, parentId, createdAt, updatedAt: createdAt };
};

const mockUser1: MockUserEntry = { id: 'user1', username: 'UserOne', email: 'u1@e.com' };
const mockUser2: MockUserEntry = { id: 'user2', username: 'UserTwo', email: 'u2@e.com' };
const mockTestPostId = 'test-post-123';
const mockPost: MockPostEntry = { id: mockTestPostId, userId: mockUser1.id, content: 'A post.' };
const TEST_PAGE_LIMIT = 2;

describe('Comment Resolver - Query.commentConnection', () => {
  let client: GraphQLTestClient;
  const now = new Date();

  const seedCommentsList = async (commentsToSeed: MockCommentEntry[]) => {
    if (!client) throw new Error("Client not initialized");
    const sortedForSeeding = commentsToSeed.sort((a,b) => a.id.localeCompare(b.id));
    await client.updateMockData(async (db) => {
      for (const comment of sortedForSeeding) {
        await db.insert(commentsTable).values({ ...comment, createdAt: new Date(comment.createdAt), updatedAt: new Date(comment.updatedAt!) }).execute();
      }
    });
  };

  beforeEach(async () => {
    client = await createGraphQLTestClient();
    await client.updateMockData(async (db) => {
      await db.insert(usersTable).values([{ ...mockUser1, createdAt: now, updatedAt: now, emailVerified: now }, { ...mockUser2, createdAt: now, updatedAt: now, emailVerified: now }]).execute();
      await db.insert(postsTable).values({ ...mockPost, createdAt: now, updatedAt: now }).execute();
    });
  });

  const fewTopLevelComments = [
    createCommentData('c1', mockUser1.id, mockTestPostId, 'C1', null, 1000),
    createCommentData('c2', mockUser2.id, mockTestPostId, 'C2', null, 2000),
    createCommentData('c3', mockUser1.id, mockTestPostId, 'C3', null, 3000),
  ];
  const manyTopLevelComments = [
    createCommentData('m1', mockUser1.id, mockTestPostId, 'M1', null, 1000),
    createCommentData('m2', mockUser2.id, mockTestPostId, 'M2', null, 2000),
    createCommentData('m3', mockUser1.id, mockTestPostId, 'M3', null, 3000),
    createCommentData('m4', mockUser2.id, mockTestPostId, 'M4', null, 4000),
    createCommentData('m5', mockUser1.id, mockTestPostId, 'M5', null, 5000),
  ];

  // --- Collapsed previous tests for brevity ---
  it('1. Authentication Required', async () => { /* ... */ });
  it('2. Post Not Found', async () => { /* ... */ });
  it('3. Fetch Top-Level Comments (Newest First)', async () => { await seedCommentsList(fewTopLevelComments); /* Assertions */ });
  it('4. Fetch Top-Level Comments (Oldest First)', async () => { await seedCommentsList(fewTopLevelComments); /* Assertions */ });
  it('5. Fetch Replies to a Parent Comment', async () => { /* Seed with replies, then Assertions */ });
  it('6. Pagination (Cursor, Next Page)', async () => { await seedCommentsList(fewTopLevelComments); /* Assertions for page 1 & 2 */ });
  it('7. Pagination (Limit)', async () => { await seedCommentsList(manyTopLevelComments); /* Assertions */ });

  it('8. No Comments Found (Top-Level): returns empty connection', async () => {
    const { data, errors } = await client.query({ query: COMMENT_CONNECTION_QUERY, variables: { postId: mockTestPostId, parentId: null }});
    expect(errors).toBeUndefined();
    const conn = data!.commentConnection;
    expect(conn.comments).toEqual([]); expect(conn.totalCount).toBe(0);
    expect(conn.hasNextPage).toBe(false); expect(conn.nextCursor).toBeNull();
  });

  it('9. No Comments Found (Replies): returns empty connection for a parent with no replies', async () => {
    // Seed one top-level comment, but no replies to it
    const parentComment = createCommentData('parentWithNoReplies', mockUser1.id, mockTestPostId, 'Parent, no replies', null, 6000);
    await seedCommentsList([parentComment]);

    const { data, errors } = await client.query({
      query: COMMENT_CONNECTION_QUERY,
      variables: {
        postId: mockTestPostId,
        parentId: parentComment.id, // Query for replies to this specific parent
      },
    });

    expect(errors).toBeUndefined();
    const conn = data!.commentConnection;

    expect(conn.comments).toEqual([]);
    expect(conn.totalCount).toBe(0);
    expect(conn.hasNextPage).toBe(false);
    expect(conn.nextCursor).toBeNull();
  });
});
