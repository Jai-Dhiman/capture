// Test file for hashtag resolver - Query.searchHashtags
import { describe, it, expect, beforeEach } from 'vitest';
import { createGraphQLTestClient, type GraphQLTestClient } from '../../../../test/utils/graphql-test-client';
import { hashtags as hashtagsTable } from '@/server/db/schema'; // Renamed import to avoid conflict
import { type Hashtag } from '@prisma/client';

// Define GraphQL Query
const SEARCH_HASHTAGS_QUERY = `
  query SearchHashtags($query: String!, $limit: Int, $offset: Int) {
    searchHashtags(query: $query, limit: $limit, offset: $offset) {
      id
      name
      # postsCount
    }
  }
`;

type MockHashtagEntry = Omit<Hashtag, 'createdAt' | 'updatedAt' | 'postsCount'> & {
    createdAt?: Date,
    updatedAt?: Date,
};

const fullMockSeedData: MockHashtagEntry[] = [
  { id: 'tag01', name: 'commonTag01' }, { id: 'tag02', name: 'commonTag02' },
  { id: 'tag03', name: 'commonTag03' }, { id: 'tag04', name: 'commonTag04' },
  { id: 'tag05', name: 'commonTag05' }, { id: 'tag06', name: 'commonTag06' },
  { id: 'tag07', name: 'commonTag07' }, { id: 'tag08', name: 'commonTag08' },
  { id: 'tag09', name: 'commonTag09' }, { id: 'tag10', name: 'commonTag10' },
  { id: 'tag11', name: 'commonTag11' }, { id: 'tag12', name: 'commonTag12' },
  { id: 'tag13', name: 'commonTag13' }, { id: 'tag14', name: 'commonTag14' },
  { id: 'tag15', name: 'commonTag15' },
  { id: 'tag16', name: 'uniqueAlpha' }, { id: 'tag17', name: 'uniqueBeta' },
];


describe('Hashtag Resolver - Query.searchHashtags', () => {
  let client: GraphQLTestClient;
  const now = new Date();

  const seedTags = async (tagsToSeed: MockHashtagEntry[]) => {
    if (!client && !(await createGraphQLTestClient())) { // Ensure client is available for unauth test too
        throw new Error("Test client not initialized and couldn't be created.");
    }
    const currentClient = client || (await createGraphQLTestClient()); // Use existing or new for unauth case

    const sortedTags = [...tagsToSeed].sort((a, b) => a.name.localeCompare(b.name));
    const insertPromises = sortedTags.map(tag =>
        currentClient.updateMockData(db => db.insert(hashtagsTable).values({ ...tag, createdAt: now, updatedAt: now }).execute())
    );
    await Promise.all(insertPromises);
  };

  beforeEach(async () => {
    client = await createGraphQLTestClient();
    await seedTags(fullMockSeedData);
  });

  it('1. Happy Path (Results Found)', async () => {
    const { query } = client;
    const { data, errors } = await query({ query: SEARCH_HASHTAGS_QUERY, variables: { query: 'commonTag0' } });
    expect(errors).toBeUndefined(); expect(data?.searchHashtags?.length).toBe(9);
  });

  it('2. Happy Path (No Results Found)', async () => {
    const { query } = client;
    const { data, errors } = await query({ query: SEARCH_HASHTAGS_QUERY, variables: { query: 'nonExistent' } });
    expect(errors).toBeUndefined(); expect(data?.searchHashtags?.length).toBe(0);
  });

  it('3. Pagination (Limit)', async () => {
    const { query } = client;
    const { data, errors } = await query({ query: SEARCH_HASHTAGS_QUERY, variables: { query: 'commonTag', limit: 5 } });
    expect(errors).toBeUndefined(); expect(data?.searchHashtags?.length).toBe(5);
    expect(data?.searchHashtags.map(t=>t.name)).toEqual(['commonTag01','commonTag02','commonTag03','commonTag04','commonTag05']);
  });

  it('4. Pagination (Offset)', async () => {
    const { query } = client;
    const { data, errors } = await query({ query: SEARCH_HASHTAGS_QUERY, variables: { query: 'commonTag', limit: 5, offset: 5 } });
    expect(errors).toBeUndefined(); expect(data?.searchHashtags?.length).toBe(5);
    expect(data?.searchHashtags.map(t=>t.name)).toEqual(['commonTag06','commonTag07','commonTag08','commonTag09','commonTag10']);
  });

  it('5. Pagination (Limit and Offset Combined)', async () => {
    const { query } = client;
    const { data, errors } = await query({ query: SEARCH_HASHTAGS_QUERY, variables: { query: 'commonTag', limit: 3, offset: 3 } });
    expect(errors).toBeUndefined(); expect(data?.searchHashtags?.length).toBe(3);
    expect(data?.searchHashtags.map(t=>t.name)).toEqual(['commonTag04','commonTag05','commonTag06']);
  });

  it('6. Authentication Required: should throw "Authentication required" error if user is not authenticated', async () => {
    // Create a new client specifically for this test, overriding the context
    const unauthClient = await createGraphQLTestClient({
      contextOverrides: { user: null },
    });
    // Optionally seed data if the auth check isn't the very first thing
    // await seedTags(fullMockSeedData); // seedTags would need to handle client assignment if client is not global for this call

    const { data, errors } = await unauthClient.query({
      query: SEARCH_HASHTAGS_QUERY,
      variables: { query: 'anyQuery' }, // Query value doesn't matter much here
    });

    expect(data?.searchHashtags).toBeNull(); // Or expect(data).toBeNull();
    expect(errors).toBeDefined();
    expect(errors?.[0].message).toBe('Authentication required');
  });
});
