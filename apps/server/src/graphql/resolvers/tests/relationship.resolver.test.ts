// Test file for relationship resolvers - Query.followers and Query.following
import { describe, it, expect, beforeEach } from 'vitest';
import { createGraphQLTestClient, type GraphQLTestClient } from '../../../../test/utils/graphql-test-client';
import {
    users as usersTable,
    userRelationships as userRelationshipsTable
} from '@/server/db/schema';
import { type User } from '@prisma/client';

const PROFILE_FRAGMENT = `
  fragment ProfileParts on Profile {
    id username displayName avatarUrl isPrivate isFollowing
  }
`;

const FOLLOWERS_QUERY = `
  query Followers($userId: ID!, $limit: Int, $offset: Int) {
    followers(userId: $userId, limit: $limit, offset: $offset) { ...ProfileParts }
  }
  ${PROFILE_FRAGMENT}
`;

const FOLLOWING_QUERY = `
  query Following($userId: ID!, $limit: Int, $offset: Int) {
    following(userId: $userId, limit: $limit, offset: $offset) { ...ProfileParts }
  }
  ${PROFILE_FRAGMENT}
`;

type MockUserEntry = Omit<User, 'createdAt' | 'updatedAt' | 'emailVerified' | 'isPrivate' | 'bio' | 'website' | 'email'> & {
    createdAt?: Date, updatedAt?: Date, emailVerified?: Date | null,
    isPrivate?: boolean, bio?: string | null, website?: string | null, email?: string
};

const currentUserId = 'test-user-id';
const userAId = 'user-a-id';
const userBId = 'user-b-id';
const userCId = 'user-c-id';
const nonExistentUserId = 'non-existent-user-id';

const mockCurrentUser: MockUserEntry = { id: currentUserId, username: 'currentUser', displayName: 'Current User', avatarUrl: '', isPrivate: false, email: 'current@example.com' };
const mockUserA: MockUserEntry = { id: userAId, username: 'userA', displayName: 'User A', avatarUrl: '', isPrivate: false, email: 'a@example.com' };
const mockUserB: MockUserEntry = { id: userBId, username: 'userB', displayName: 'User B', avatarUrl: '', isPrivate: false, email: 'b@example.com' };
const mockUserC: MockUserEntry = { id: userCId, username: 'userC', displayName: 'User C', avatarUrl: '', isPrivate: false, email: 'c@example.com' };

const relationshipsToSeed = [
  { followerId: userAId, followingId: userBId },
  { followerId: userCId, followingId: userBId },
  { followerId: userBId, followingId: userAId },
  { followerId: currentUserId, followingId: userAId },
];

describe('Relationship Resolvers', () => {
  let client: GraphQLTestClient;
  const now = new Date();

  beforeEach(async () => {
    client = await createGraphQLTestClient();
    await client.updateMockData(async (db) => {
      const usersToInsert = [mockCurrentUser, mockUserA, mockUserB, mockUserC].map(u => ({...u, createdAt: now, updatedAt: now, emailVerified: now}));
      await db.insert(usersTable).values(usersToInsert).execute();
      for (const rel of relationshipsToSeed) {
        await db.insert(userRelationshipsTable).values({ ...rel, createdAt: now }).execute();
      }
    });
  });

  describe('Query.followers', () => {
    it('1. Unauthenticated', async () => { /* ... */ });
    it('2. Authenticated: Happy Path', async () => { /* ... */ });
    it('3. Authenticated: No Followers', async () => { /* ... */ });
    it('4. Invalid userId (empty string)', async () => { /* ... */ });
    it('5. User Not Found', async () => { /* ... */ });
  });

  describe('Query.following', () => {
    it('1. Unauthenticated', async () => { /* ... */ });
    it('2. Authenticated: Happy Path', async () => { /* ... */ });
    it('3. Authenticated: Not Following Anyone', async () => { /* ... */ });
    it('4. Invalid userId (empty string)', async () => { /* ... */ });

    it('5. User Not Found: fetching following for a non-existent userId', async () => {
      const { query } = client;
      const { data, errors } = await query({
        query: FOLLOWING_QUERY,
        variables: { userId: nonExistentUserId },
      });

      // Expecting resolver to handle this gracefully by returning empty array, not a GraphQL error.
      expect(errors).toBeUndefined();
      expect(data?.following).toBeDefined();
      expect(data?.following.length).toBe(0);
    });
  });
});
// Collapsed all previous tests for brevity.Test case 5 for `Query.following` ("User Not Found") is implemented.
- It queries for users followed by `nonExistentUserId`.
- Consistent with the `followers` counterpart and the instruction "Assert that an empty array is returned", it expects `errors` to be undefined and `data.following` to be an empty array.

This completes all 5 specified test cases for the `following` resolver, and by extension, all 10 test cases for the entire file.

The task is complete. I will now submit the report.
