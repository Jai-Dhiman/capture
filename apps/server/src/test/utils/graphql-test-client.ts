import { vi } from "vitest";
import { ApolloServer } from "@apollo/server";
import { typeDefs } from "@/graphql/schema";
import { resolvers as allResolvers } from "@/graphql/resolvers";
import { mockQueryBuilder, initializeMockData, testData } from "@/test/mocks/db-mock";
import type { ContextType } from "@/types";

interface TestClientOptions {
  mockData?: Record<string, any[]>;
  contextOverrides?: Partial<ContextType>;
}

export function createGraphQLTestClient(options: TestClientOptions = {}): {
  query: (query: string, options?: { variables?: Record<string, any> }) => Promise<any>;
  mutate: (mutation: string, options?: { variables?: Record<string, any> }) => Promise<any>;
  updateMockData: (modifier: (db: typeof mockQueryBuilder) => Promise<void>) => Promise<void>;
  cleanup: () => Promise<void>;
} {
  const { mockData = {}, contextOverrides = {} } = options;

  // Initialize mock data ONLY if it's explicitly passed in the options
  // The test setup (e.g., beforeEach) should be responsible for the general clearing (initializeMockData({}))
  if (Object.keys(mockData).length > 0) {
    initializeMockData(mockData);
  }
  // ELSE: Do not call initializeMockData({}) here by default.
  // This prevents double-clearing when tests also call it in their beforeEach.

  // Create Apollo Server instance
  const server = new ApolloServer({
    typeDefs,
    resolvers: allResolvers,
  });

  // Start the server
  let serverStarted = false;

  // Default context
  const defaultContext: ContextType = {
    env: {
      DB: mockQueryBuilder as any, // Using mockQueryBuilder, cast to any to satisfy D1Database/Bindings temporarily
      BUCKET: {} as R2Bucket,
      CLOUDFLARE_ACCOUNT_ID: "test-account-id",
      CLOUDFLARE_ACCOUNT_HASH: "test-account-hash",
      CLOUDFLARE_IMAGES_TOKEN: "test-images-token",
      CLOUDFLARE_IMAGES_KEY: "test-images-key",
      // Required by Bindings type - add actual mocks or leave as dummy values if not used by these tests
      KV: {} as any, 
      REFRESH_TOKEN_KV: {} as any,
      Capture_Rate_Limits: {} as any,
      POST_VECTORS: {} as any, 
      USER_VECTORS: {} as any,
      VECTORIZE: {} as any,
      SEED_SECRET: "mock-seed-secret",
      JWT_SECRET: "mock-jwt-secret",
      AI: {} as any,
      POST_QUEUE: {} as any,
      USER_VECTOR_QUEUE: {} as any,

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
    async updateMockData(modifier: (db: typeof mockQueryBuilder) => Promise<void>) {
      await modifier(mockQueryBuilder);
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
