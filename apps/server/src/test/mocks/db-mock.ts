import { vi } from "vitest";

// Define an interface for the mock D1 client and query builder
interface MockStatement {
  bind: (...args: any[]) => MockStatement;
  first: <T = any>() => Promise<T | null>;
  all: <T = any>() => Promise<T[]>;
  run: () => Promise<any>; // Adjust return type based on D1 run specifics
  raw: <T = any>() => Promise<T[][]>; // Added raw method
}

interface MockD1ClientAndQueryBuilder {
  select: (fields: any) => MockD1ClientAndQueryBuilder;
  from: (table: any) => MockD1ClientAndQueryBuilder;
  where: (condition: any) => MockD1ClientAndQueryBuilder;
  limit: (limit: number) => MockD1ClientAndQueryBuilder;
  offset: (offset: number) => MockD1ClientAndQueryBuilder;
  orderBy: (column: string | any, direction?: "asc" | "desc") => MockD1ClientAndQueryBuilder;
  get: <T = any>() => Promise<T | null>;
  all: <T = any>() => Promise<T[]>;
  insert: (table: any) => {
    values: (values: any) => {
      returning: () => Promise<any[]>;
      execute: () => Promise<any>;
    };
  };
  update: (table: any) => {
    set: (values: any) => {
      where: (condition: any) => {
        execute: () => Promise<any>;
      };
      execute: () => Promise<any>; // For updates without a where clause
    };
  };
  delete: (table: any) => {
    where: (condition: any) => {
      execute: () => Promise<any>;
    };
    execute: () => Promise<any>; // For deletes without a where clause
  };
  prepare: (query: string | any) => MockStatement;
  exec: (query?: string) => Promise<any>; // Adjust based on D1 exec specifics
  batch: <T = any>(statements: any[]) => Promise<T[]>; // Adjust based on D1 batch specifics
}

// Create mock data stores for each table
const mockDataStores: Record<string, Map<string, any>> = {
  users: new Map<string, any>(),
  profile: new Map<string, any>(),
  post: new Map<string, any>(),
  comment: new Map<string, any>(),
  relationship: new Map<string, any>(),
  hashtag: new Map<string, any>(),
  savedPost: new Map<string, any>(),
  blocked_user: new Map<string, any>(),
  media: new Map<string, any>(),
};

// Helper to initialize mock data
export function initializeMockData(initialData: Record<string, any[]> = {}) {
  // Clear existing data
  for (const key of Object.keys(mockDataStores)) {
    mockDataStores[key as keyof typeof mockDataStores].clear();
  }

  // Load initial data
  for (const [table, records] of Object.entries(initialData)) {
    if (mockDataStores[table as keyof typeof mockDataStores]) {
      for (const record of records) {
        mockDataStores[table as keyof typeof mockDataStores].set(record.id, record);
      }
    }
  }
}

// Export mockDataStores for debugging purposes
export { mockDataStores };

// Create a mock D1 client that simulates database operations
function createD1ClientMock(): MockD1ClientAndQueryBuilder {
  let currentTable: string | null = null;
  let whereConditions: any[] = [];
  let limitValue: number | null = null;
  let offsetValue: number | null = null;
  let orderByColumn: string | null = null;
  let orderDirection: "asc" | "desc" = "asc";
  let selectedFields: any | null = null;
  let operationType: "select" | "insert" | "update" | "delete" | null = null;
  let insertValues: any | null = null;
  let updateValues: any | null = null;

  const resetState = () => {
    currentTable = null;
    whereConditions = [];
    limitValue = null;
    offsetValue = null;
    orderByColumn = null;
    orderDirection = "asc";
    selectedFields = null;
    operationType = null;
    insertValues = null;
    updateValues = null;
  };

  // helper to evaluate a single where condition on an item
  function evaluateCondition(item: any, condition: any): boolean {
    // Handle Drizzle ORM condition objects
    
    // Comprehensive debug logging
    if (process.env.NODE_ENV === 'test') {
      console.log('DEBUG: evaluateCondition - condition keys:', Object.keys(condition || {}));
      console.log('DEBUG: evaluateCondition - condition type:', typeof condition);
      console.log('DEBUG: evaluateCondition - condition constructor:', condition?.constructor?.name);
      
      // Log queryChunks in detail
      if (condition?.queryChunks) {
        console.log('DEBUG: queryChunks length:', condition.queryChunks.length);
        condition.queryChunks.forEach((chunk: any, index: number) => {
          if (chunk && typeof chunk === 'object') {
            console.log(`DEBUG: queryChunk[${index}] keys:`, Object.keys(chunk));
            console.log(`DEBUG: queryChunk[${index}] constructor:`, chunk.constructor?.name);
            console.log(`DEBUG: queryChunk[${index}] operator:`, chunk.operator);
            console.log(`DEBUG: queryChunk[${index}] left:`, chunk.left?.name || chunk.left?.column?.name || chunk.left?._?.name);
            console.log(`DEBUG: queryChunk[${index}] right:`, chunk.right);
          } else {
            console.log(`DEBUG: queryChunk[${index}]:`, typeof chunk, chunk);
          }
        });
      }
    }
    
    // Handle 'and' conditions (typically from and() function)
    if (condition && condition.operator === 'and' && Array.isArray(condition.left) && Array.isArray(condition.right)) {
      // Drizzle 'and' has left and right arrays of conditions
      const leftResults = condition.left.every((cond: any) => evaluateCondition(item, cond));
      const rightResults = condition.right.every((cond: any) => evaluateCondition(item, cond));
      return leftResults && rightResults;
    }
    
    // Handle 'and' conditions with different structure
    if (condition && (condition.operator === 'and' || condition.kind === 'and')) {
      const conditions = condition.conditions || condition.expressions || condition.values || [];
      return Array.isArray(conditions) && conditions.every((cond: any) => evaluateCondition(item, cond));
    }

    // Handle equality conditions (typically from eq() function)
    if (condition && condition.operator === '=' && condition.left && condition.right !== undefined) {
      // Extract column name from Drizzle column object
      const columnName = condition.left.name || condition.left.column?.name || condition.left._?.name;
      return columnName && item[columnName] === condition.right;
    }

    // Handle legacy condition formats for backward compatibility
    if (condition && Array.isArray(condition.queryChunks)) {
      // extract only real sub-conditions (objects with operator or op)
      const subConds = condition.queryChunks.filter((c: any) => c && typeof c === 'object' && (c.operator === '=' || c.operator === 'LIKE' || c.op === 'and' || c.op === 'or'));
      if (subConds.length > 0) {
        // treat composite SQL fragments as AND of sub-conditions
        return subConds.every((c: any) => evaluateCondition(item, c));
      }
    }
    if (condition.operator === '=') {
      const key = condition.leftOperand?._?.name || condition.leftOperand?.name;
      return key != null && item[key] === condition.rightOperand;
    }
    if (condition.operator === 'LIKE') {
      const key = condition.leftOperand?._?.name || condition.leftOperand?.name;
      const val = condition.rightOperand;
      if (key == null) return false;
      const pattern = String(val).replace(/%/g, '.*');
      return new RegExp(pattern).test(item[key]);
    }
    if (condition.op === 'and' || condition.operator === 'and') {
      const exprs = condition.expressions || condition.values || condition.config?.values;
      return Array.isArray(exprs) && exprs.every((e: any) => evaluateCondition(item, e));
    }
    if (condition.op === 'or' || condition.operator === 'or') {
      const exprs = condition.expressions || condition.values || condition.config?.values;
      return Array.isArray(exprs) && exprs.some((e: any) => evaluateCondition(item, e));
    }
    if (condition.operator === 'is null') {
      const key = condition.leftOperand?._?.name || condition.leftOperand?.name;
      return key != null && (item[key] === null || item[key] === undefined);
    }
    
    // For unhandled conditions, return false (this was the main fix)
    console.log('DEBUG: Unhandled condition, returning false');
    return false;
  };

  const applyQueryLogic = (items: any[]) => {
    let results = [...items];

    if (whereConditions.length > 0) {
      results = results.filter(item =>
        whereConditions.every(cond => evaluateCondition(item, cond))
      );
    }

    // Apply order by
    if (orderByColumn) {
      const column = orderByColumn as string;
      results.sort((a, b) => {
        if (!Object.prototype.hasOwnProperty.call(a, column) || !Object.prototype.hasOwnProperty.call(b, column)) {
            return 0; 
        }
        if (a[column] === b[column]) return 0;
        if (orderDirection === "asc") {
          return a[column] > b[column] ? 1 : -1;
        }
        return a[column] < b[column] ? 1 : -1;
      });
    }

    // Apply offset
    if (offsetValue !== null) {
      results = results.slice(offsetValue);
    }

    // Apply limit
    if (limitValue !== null) {
      results = results.slice(0, limitValue);
    }
    return results;
  };

  const statementMock: MockStatement = {
    bind: vi.fn((..._args: any[]) => statementMock),
    first: vi.fn(async <T = any>(): Promise<T | null> => {
      if (!currentTable || !mockDataStores[currentTable]) {
        resetState();
        return null;
      }
      const store = mockDataStores[currentTable];
      const allItems = Array.from(store.values());
      
      const processedResults = applyQueryLogic(allItems);

      // Handle count queries specifically
      if (selectedFields && typeof selectedFields === 'object' && selectedFields.count) {
         resetState();
         return { count: processedResults.length } as any;
      }
      
      const result = processedResults.length > 0 ? processedResults[0] : null;
      resetState();
      return result;
    }),
    all: vi.fn(async <T = any>(): Promise<T[]> => {
      if (!currentTable || !mockDataStores[currentTable]) {
        resetState();
        return [];
      }
      const store = mockDataStores[currentTable];
      const allItems = Array.from(store.values());

      const results = applyQueryLogic(allItems);
      resetState();
      return results;
    }),
    raw: vi.fn(async <T = any>(): Promise<T[][]> => {
      if (!currentTable || !mockDataStores[currentTable]) {
        resetState();
        return [];
      }
      const store = mockDataStores[currentTable];
      const allItems = Array.from(store.values());
      const processedResults = applyQueryLogic(allItems);

      const rawResults = processedResults.map(row => {
        if (selectedFields && Array.isArray(selectedFields) && selectedFields.length > 0) {
          // If specific columns were selected, return values in that order
          return selectedFields.map(field => row[field]);
        }
        // Otherwise, return all values of the row object
        return Object.values(row);
      });

      resetState();
      return rawResults as T[][];
    }),
    run: vi.fn(async () => {

      if (!currentTable || !mockDataStores[currentTable] || !operationType) {
        console.error(`DEBUG: statementMock.run - BAILING. Table: ${currentTable}, Op: ${operationType}`);
        resetState();
        return { success: false, meta: { duration: 0 } };
      }
      const store = mockDataStores[currentTable];
      let affectedRows = 0;

      if (operationType === "insert" && insertValues) {
        // Handle single or multiple inserts
        const itemsToInsert = Array.isArray(insertValues) ? insertValues : [insertValues];
        for (const item of itemsToInsert) {
          if (item.id && !store.has(item.id)) {
            store.set(item.id, { ...item });
            affectedRows++;
          } else if (!item.id) { // auto-generate ID if not provided (basic)
            const tempId = `temp_id_${Date.now()}_${Math.random()}`;
            store.set(tempId, { ...item, id: tempId });
            affectedRows++;
          }
        }
        resetState();
        return { success: true, meta: { duration: 0, rows_written: affectedRows } };
      }

      if (operationType === "update" && updateValues) {
        const itemsToUpdate = applyQueryLogic(Array.from(store.values()));
        for (const item of itemsToUpdate) {
          if (store.has(item.id)) {
            store.set(item.id, { ...item, ...updateValues });
            affectedRows++;
          }
        }
        resetState();
        return { rowsAffected: affectedRows, success: true, meta: { duration: 0 } };
      }

      if (operationType === "delete") {
        const itemsToDelete = applyQueryLogic(Array.from(store.values()));
        for (const item of itemsToDelete) {
          if (store.has(item.id)) {
            store.delete(item.id);
            affectedRows++;
          }
        }
        resetState();
        return { rowsAffected: affectedRows, success: true, meta: { duration: 0 } };
      }
      resetState();
      return { success: false, meta: { duration: 0 } };
    }),
  };

  const queryBuilder: MockD1ClientAndQueryBuilder = {
    select: (fieldsToSelect?: any) => {
      operationType = "select";
      selectedFields = fieldsToSelect || { count: false };
      return queryBuilder;
    },
    from: (table: any) => {
      // Correctly get table name from Drizzle schema object
      const tableName = table[Symbol.for("drizzle:BaseName")] || 
                        table[Symbol.for("drizzle:SQLiteName")] || 
                        table["_->tableName"] || 
                        table.dbName || 
                        (table._?.name) || 
                        table.name;

      if (!tableName) {
        console.error("Mock DB (from): Could not determine table name from Drizzle object provided:", table);
        currentTable = "unknown_table_error_from"; 
      } else {
        currentTable = tableName;
      }
      
      if (currentTable && !mockDataStores[currentTable]) {
        // console.warn(`Mock DB: Table '${currentTable}' was not pre-defined in mockDataStores (from).`);
      }
      return queryBuilder;
    },
    where: (condition: any) => {
      whereConditions.push(condition);
      return queryBuilder;
    },
    limit: vi.fn((limit: number) => {
      limitValue = limit;
      return queryBuilder;
    }),
    offset: vi.fn((offset: number) => {
      offsetValue = offset;
      return queryBuilder;
    }),
    orderBy: vi.fn((column: string | any, direction?: "asc" | "desc") => {
      if (typeof column === 'object' && column.column) {
        orderByColumn = column.column.name;
      } else if (typeof column === 'string') {
        orderByColumn = column;
      }
      if (typeof column === 'object' && column.order) {
         orderDirection = column.order;
      } else if (direction) {
        orderDirection = direction;
      }
      return queryBuilder;
    }),
    get: vi.fn(async <T = any>(): Promise<T | null> => {

      try {
        if (typeof statementMock.first !== 'function') {
          console.error("CRITICAL_DEBUG: statementMock.first is NOT a function!");
          // resetState(); // Avoid side-effects during this debug
          return null; 
        }
        const result = await statementMock.first<T>();
        return result;
      } catch (e: any) {
        console.error("CRITICAL_DEBUG: Error calling statementMock.first() from queryBuilder.get():", e.message, e.stack);
        // resetState(); // Avoid side-effects
        throw e; 
      }
    }),
    all: vi.fn(async <T = any>(): Promise<T[]> => {
      return statementMock.all<T>();
    }),
    insert: vi.fn((table: any) => {
      operationType = "insert";
      const tableName = table[Symbol.for("drizzle:BaseName")] || 
                        table[Symbol.for("drizzle:SQLiteName")] || 
                        table["_->tableName"] || 
                        table.dbName || 
                        (table._?.name) || 
                        table.name;
      if (!tableName) {
        console.error("Mock DB (insert): Could not determine table name from Drizzle object provided:", table);
        currentTable = "unknown_table_error_insert";
      } else {
        currentTable = tableName;
      }
      if (currentTable && !mockDataStores[currentTable]) {
        // console.warn(`Mock DB: Table '${currentTable}' was not pre-defined in mockDataStores (insert). Auto-initializing.`);
        // mockDataStores[currentTable] = new Map<string, any>();
      }
      return {
        values: vi.fn((values: any) => {
          insertValues = values;
          return {
            returning: vi.fn(async () => {
              // Ensure run uses the currentTable set by insert
              await statementMock.run(); 
              return Array.isArray(insertValues) ? insertValues : [insertValues];
            }),
            execute: vi.fn(async () => statementMock.run()),
          };
        }),
      };
    }),
    update: vi.fn((table: any) => {
      operationType = "update";
      const tableName = table[Symbol.for("drizzle:BaseName")] || 
                        table[Symbol.for("drizzle:SQLiteName")] || 
                        table["_->tableName"] || 
                        table.dbName || 
                        (table._?.name) || 
                        table.name;
      if (!tableName) {
        console.error("Mock DB (update): Could not determine table name from Drizzle object provided:", table);
        currentTable = "unknown_table_error_update";
      } else {
        currentTable = tableName;
      }
       if (currentTable && !mockDataStores[currentTable]) {
        // console.warn(`Mock DB: Table '${currentTable}' was not pre-defined in mockDataStores (update).`);
      }
      return {
        set: vi.fn((values: any) => {
          updateValues = values;
          return {
            where: vi.fn((condition: any) => {
              whereConditions.push(condition);
              return {
                execute: vi.fn(async () => statementMock.run()),
              };
            }),
            execute: vi.fn(async () => statementMock.run()),
          };
        }),
      };
    }),
    delete: vi.fn((table: any) => {
      operationType = "delete";
      const tableName = table[Symbol.for("drizzle:BaseName")] || 
                        table[Symbol.for("drizzle:SQLiteName")] || 
                        table["_->tableName"] || 
                        table.dbName || 
                        (table._?.name) || 
                        table.name;
      if (!tableName) {
        console.error("Mock DB (delete): Could not determine table name from Drizzle object provided:", table);
        currentTable = "unknown_table_error_delete";
      } else {
        currentTable = tableName;
      }
      if (currentTable && !mockDataStores[currentTable]) {
        // console.warn(`Mock DB: Table '${currentTable}' was not pre-defined in mockDataStores (delete).`);
      }
      return {
        where: vi.fn((condition: any) => {
          whereConditions.push(condition);
          return {
            execute: vi.fn(async () => statementMock.run()),
          };
        }),
        execute: vi.fn(async () => statementMock.run()),
      };
    }),
    prepare: vi.fn((_query: string | any) => {
      return statementMock;
    }),
    exec: vi.fn().mockResolvedValue({ success: true, results: [], meta: { duration: 0 } }),
    batch: vi.fn().mockResolvedValue([]),
  };

  return queryBuilder;
}

export const mockQueryBuilder = createD1ClientMock();

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
      // updatedAt is missing here based on original, but usually present
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
