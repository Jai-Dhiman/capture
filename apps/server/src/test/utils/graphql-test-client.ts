import { vi } from "vitest";
import { ApolloServer } from "@apollo/server";
import { typeDefs } from "../../graphql/schema";
import { resolvers as allResolvers } from "../../graphql/resolvers";
import { mockQueryBuilder, initializeMockData, testData, mockDb } from "../../test/mocks/db-mock";
import type { ContextType } from "../../types";

interface TestClientOptions {
  mockData?: Record<string, any[]>;
  contextOverrides?: Partial<ContextType>;
}

export function createGraphQLTestClient(options: TestClientOptions = {}): {
  query: (query: string, options?: { variables?: Record<string, any> }) => Promise<any>;
  mutate: (mutation: string, options?: { variables?: Record<string, any> }) => Promise<any>;
  updateMockData: (newData: Record<string, any[]>) => void;
  cleanup: () => Promise<void>;
} {
  const { mockData = {}, contextOverrides = {} } = options;

  // Initialize mock data
  initializeMockData({
    profile: testData.profiles,
    post: testData.posts,
    comment: testData.comments,
    relationship: testData.relationships,
    ...mockData,
  });

  // Create Apollo Server instance
  const server = new ApolloServer({
    typeDefs,
    resolvers: allResolvers,
  });

  // Start the server
  let serverStarted = false;

  // Create a complete mock D1Database by combining mockQueryBuilder with mockDb
  const mockD1Database = {
    ...mockQueryBuilder,
    ...mockDb,
    withSession: vi.fn().mockReturnThis(),
    dump: vi.fn().mockResolvedValue({}),
  };

  // Default context
  const defaultContext: ContextType = {
    env: {
      DB: mockD1Database as unknown as D1Database,
      BUCKET: {} as R2Bucket,
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_KEY: "test-key",
      CLOUDFLARE_ACCOUNT_ID: "test-account-id",
      CLOUDFLARE_ACCOUNT_HASH: "test-account-hash",
      CLOUDFLARE_IMAGES_TOKEN: "test-images-token",
      CLOUDFLARE_IMAGES_KEY: "test-images-key",
    },
    user: { id: "test-user-id" },
  };

  // Create a test client that executes operations against the server
  return {
    async query(query: string, options: { variables?: Record<string, any> } = {}) {
      if (!serverStarted) {
        await server.start();
        serverStarted = true;
      }

      try {
        const response = await server.executeOperation(
          {
            query,
            variables: options.variables || {},
          },
          {
            contextValue: { ...defaultContext, ...contextOverrides },
          }
        );

        return response.body;
      } catch (error) {
        console.error("GraphQL query error:", error);
        throw error;
      }
    },

    async mutate(mutation: string, options: { variables?: Record<string, any> } = {}) {
      if (!serverStarted) {
        await server.start();
        serverStarted = true;
      }

      try {
        const response = await server.executeOperation(
          {
            query: mutation,
            variables: options.variables || {},
          },
          {
            contextValue: { ...defaultContext, ...contextOverrides },
          }
        );

        return response.body;
      } catch (error) {
        console.error("GraphQL mutation error:", error);
        throw error;
      }
    },

    // Helper to reset or update mock data during tests
    updateMockData(newData: Record<string, any[]>) {
      initializeMockData(newData);
    },

    // Clean up resources
    async cleanup() {
      if (serverStarted) {
        await server.stop();
        serverStarted = false;
      }
    },
  };
}
