import { vi } from "vitest";
import * as schema from "../../db/schema";

// Create mock data stores for each table
const mockDataStores = {
  profile: new Map<string, any>(),
  post: new Map<string, any>(),
  comment: new Map<string, any>(),
  relationship: new Map<string, any>(),
  hashtag: new Map<string, any>(),
  savedPost: new Map<string, any>(),
  blocking: new Map<string, any>(),
  media: new Map<string, any>(),
};

// Helper to initialize mock data
export function initializeMockData(initialData: Record<string, any[]> = {}) {
  // Clear existing data
  Object.keys(mockDataStores).forEach((key) => {
    mockDataStores[key as keyof typeof mockDataStores].clear();
  });

  // Load initial data
  Object.entries(initialData).forEach(([table, records]) => {
    if (mockDataStores[table as keyof typeof mockDataStores]) {
      records.forEach((record) => {
        mockDataStores[table as keyof typeof mockDataStores].set(record.id, record);
      });
    }
  });
}

// Create a mock query builder that simulates database operations
function createMockQueryBuilder() {
  let currentTable: string | null = null;
  let whereConditions: any[] = [];
  let limitValue: number | null = null;
  let offsetValue: number | null = null;
  let orderByColumn: string | null = null;
  let orderDirection: "asc" | "desc" = "asc";
  let selectedColumns: string[] | null = null;

  const reset = () => {
    currentTable = null;
    whereConditions = [];
    limitValue = null;
    offsetValue = null;
    orderByColumn = null;
    orderDirection = "asc";
    selectedColumns = null;
  };

  const queryBuilder = {
    select: vi.fn((...columns: any[]) => {
      selectedColumns = columns.length ? columns : null;
      return queryBuilder;
    }),
    from: vi.fn((table: any) => {
      // Extract table name from schema object
      if (table && typeof table === "object" && table.name) {
        currentTable = table.name;
      } else if (typeof table === "string") {
        currentTable = table;
      }
      return queryBuilder;
    }),
    where: vi.fn((condition: any) => {
      whereConditions.push(condition);
      return queryBuilder;
    }),
    limit: vi.fn((limit: number) => {
      limitValue = limit;
      return queryBuilder;
    }),
    offset: vi.fn((offset: number) => {
      offsetValue = offset;
      return queryBuilder;
    }),
    orderBy: vi.fn((column: string, direction: "asc" | "desc" = "asc") => {
      orderByColumn = column;
      orderDirection = direction;
      return queryBuilder;
    }),
    get: vi.fn(async () => {
      if (!currentTable || !mockDataStores[currentTable as keyof typeof mockDataStores]) {
        reset();
        return null;
      }

      const store = mockDataStores[currentTable as keyof typeof mockDataStores];
      let results = Array.from(store.values());

      // Apply where conditions (simplified implementation)
      if (whereConditions.length > 0) {
        // This is a simplified implementation that handles Drizzle ORM operators
        results = results.filter((item) => {
          return whereConditions.every((condition) => {
            // Handle eq, like, and, etc. from drizzle-orm
            if (condition && typeof condition === "object") {
              // Handle 'eq' operator
              if (condition.operator === "=") {
                const key = condition.leftOperand?.column?.name || condition.leftOperand?.name;
                const value = condition.rightOperand;
                return item[key] === value;
              }
              // Handle 'like' operator
              else if (condition.operator === "LIKE") {
                const key = condition.leftOperand?.column?.name || condition.leftOperand?.name;
                const value = condition.rightOperand;
                const pattern = value.replace(/%/g, ".*");
                const regex = new RegExp(pattern);
                return regex.test(item[key]);
              }
              // Handle 'and' operator
              else if (condition.op === "and") {
                return condition.expressions.every((expr: any) => {
                  const key = expr.leftOperand?.column?.name || expr.leftOperand?.name;
                  const value = expr.rightOperand;
                  return item[key] === value;
                });
              }
            }
            return true;
          });
        });
      }

      // Apply order by
      if (orderByColumn) {
        const column = orderByColumn as string;
        results.sort((a, b) => {
          if (orderDirection === "asc") {
            return a[column] > b[column] ? 1 : -1;
          } else {
            return a[column] < b[column] ? 1 : -1;
          }
        });
      }

      // Apply offset
      if (offsetValue) {
        results = results.slice(offsetValue);
      }

      // Apply limit
      if (limitValue) {
        results = results.slice(0, limitValue);
      }

      reset();
      return results.length > 0 ? results[0] : null;
    }),
    all: vi.fn(async () => {
      if (!currentTable || !mockDataStores[currentTable as keyof typeof mockDataStores]) {
        reset();
        return [];
      }

      const store = mockDataStores[currentTable as keyof typeof mockDataStores];
      let results = Array.from(store.values());

      // Apply where conditions (simplified implementation)
      if (whereConditions.length > 0) {
        // This is a simplified implementation that handles Drizzle ORM operators
        results = results.filter((item) => {
          return whereConditions.every((condition) => {
            // Handle eq, like, and, etc. from drizzle-orm
            if (condition && typeof condition === "object") {
              // Handle 'eq' operator
              if (condition.operator === "=") {
                const key = condition.leftOperand?.column?.name || condition.leftOperand?.name;
                const value = condition.rightOperand;
                return item[key] === value;
              }
              // Handle 'like' operator
              else if (condition.operator === "LIKE") {
                const key = condition.leftOperand?.column?.name || condition.leftOperand?.name;
                const value = condition.rightOperand;
                const pattern = value.replace(/%/g, ".*");
                const regex = new RegExp(pattern);
                return regex.test(item[key]);
              }
              // Handle 'and' operator
              else if (condition.op === "and") {
                return condition.expressions.every((expr: any) => {
                  const key = expr.leftOperand?.column?.name || expr.leftOperand?.name;
                  const value = expr.rightOperand;
                  return item[key] === value;
                });
              }
            }
            return true;
          });
        });
      }

      // Apply order by
      if (orderByColumn) {
        const column = orderByColumn as string;
        results.sort((a, b) => {
          if (orderDirection === "asc") {
            return a[column] > b[column] ? 1 : -1;
          } else {
            return a[column] < b[column] ? 1 : -1;
          }
        });
      }

      // Apply offset
      if (offsetValue) {
        results = results.slice(offsetValue);
      }

      // Apply limit
      if (limitValue) {
        results = results.slice(0, limitValue);
      }

      reset();
      return results;
    }),
    // Mock insert operation
    insert: vi.fn((table: any) => ({
      values: vi.fn((values: any) => ({
        returning: vi.fn(async () => {
          const tableName = table.name;
          if (!tableName || !mockDataStores[tableName as keyof typeof mockDataStores]) {
            return null;
          }

          const store = mockDataStores[tableName as keyof typeof mockDataStores];
          store.set(values.id, values);
          return [values];
        }),
        execute: vi.fn(async () => {
          const tableName = table.name;
          if (!tableName || !mockDataStores[tableName as keyof typeof mockDataStores]) {
            return null;
          }

          const store = mockDataStores[tableName as keyof typeof mockDataStores];
          store.set(values.id, values);
          return { insertId: values.id };
        }),
      })),
    })),
    // Mock update operation
    update: vi.fn((table: any) => ({
      set: vi.fn((values: any) => ({
        where: vi.fn((condition: any) => ({
          execute: vi.fn(async () => {
            const tableName = table.name;
            if (!tableName || !mockDataStores[tableName as keyof typeof mockDataStores]) {
              return null;
            }

            const store = mockDataStores[tableName as keyof typeof mockDataStores];
            let updated = 0;

            // Apply condition to find records to update
            store.forEach((record, id) => {
              if (condition && typeof condition === "object") {
                if (condition.leftOperand && condition.rightOperand) {
                  const key = condition.leftOperand.name;
                  const value = condition.rightOperand;

                  if (record[key] === value) {
                    store.set(id, { ...record, ...values });
                    updated++;
                  }
                }
              }
            });

            return { rowsAffected: updated };
          }),
        })),
      })),
    })),
    // Mock delete operation
    delete: vi.fn((table: any) => ({
      where: vi.fn((condition: any) => ({
        execute: vi.fn(async () => {
          const tableName = table.name;
          if (!tableName || !mockDataStores[tableName as keyof typeof mockDataStores]) {
            return null;
          }

          const store = mockDataStores[tableName as keyof typeof mockDataStores];
          let deleted = 0;

          // Apply condition to find records to delete
          store.forEach((record, id) => {
            if (condition && typeof condition === "object") {
              if (condition.leftOperand && condition.rightOperand) {
                const key = condition.leftOperand.name;
                const value = condition.rightOperand;

                if (record[key] === value) {
                  store.delete(id);
                  deleted++;
                }
              }
            }
          });

          return { rowsAffected: deleted };
        }),
      })),
    })),
  };

  return queryBuilder;
}

export const mockDb = {
  exec: vi.fn().mockResolvedValue({ results: [] }),
  batch: vi.fn().mockResolvedValue([]),
  prepare: vi.fn().mockReturnValue({
    bind: vi.fn().mockReturnThis(),
    first: vi.fn().mockResolvedValue(null),
    all: vi.fn().mockResolvedValue([]),
    run: vi.fn().mockResolvedValue({ success: true }),
  }),
};

export const mockQueryBuilder = createMockQueryBuilder();

export const mockCreateD1Client = vi.fn().mockImplementation(() => mockQueryBuilder);

export const testData = {
  profiles: [
    {
      id: "1",
      userId: "test-user-id",
      username: "testuser",
      bio: "Test bio",
      profileImage: "test-image.jpg",
      isPrivate: 0,
      verifiedType: "none",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: "2",
      userId: "other-user-id",
      username: "otheruser",
      bio: "Other bio",
      profileImage: "other-image.jpg",
      isPrivate: 0,
      verifiedType: "none",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ],
  posts: [
    {
      id: "1",
      userId: "test-user-id",
      content: "Test post content",
      type: "post",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ],
  comments: [
    {
      id: "1",
      postId: "1",
      userId: "test-user-id",
      content: "Test comment",
      path: "0001",
      depth: 1,
      isDeleted: 0,
      createdAt: new Date().toISOString(),
    },
  ],
  relationships: [
    {
      id: "1",
      followerId: "test-user-id",
      followedId: "other-user-id",
      createdAt: new Date().toISOString(),
    },
  ],
};
