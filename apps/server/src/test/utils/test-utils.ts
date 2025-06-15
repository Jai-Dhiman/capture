import type {
  Ai,
  D1Database,
  DurableObjectNamespace,
  DurableObjectStub,
  KVNamespace,
  Queue,
  R2Bucket,
  VectorizeIndex,
} from '@cloudflare/workers-types';
import { nanoid } from 'nanoid';
import { vi } from 'vitest';
import type { Bindings } from '../../types';

export function createMockBindings(): Bindings {
  const bindings = {
    DB: {
      prepare: vi.fn(),
      execute: vi.fn(),
      exec: vi.fn(),
      batch: vi.fn(),
      createStatement: vi.fn(),
      dump: vi.fn(),
      _name: 'test-db',
    } as unknown as D1Database,
    BUCKET: {
      put: vi.fn().mockResolvedValue(undefined),
      get: vi.fn().mockResolvedValue({
        arrayBuffer: async () => new ArrayBuffer(0),
        body: new ReadableStream(),
        bodyUsed: false,
        etag: 'etag',
        httpEtag: 'httpEtag',
        key: 'key',
        size: 0,
        uploaded: new Date(),
        version: 'version',
        writeHttpMetadata: vi.fn(),
      }),
      delete: vi.fn().mockResolvedValue(undefined),
      head: vi.fn(),
      list: vi.fn(),
      createMultipartUpload: vi.fn().mockResolvedValue({
        uploadId: 'test-upload-id',
        key: 'test-key',
      }),
      resumeMultipartUpload: vi.fn().mockResolvedValue({
        uploadId: 'test-upload-id',
        key: 'test-key',
      }),
    } as unknown as R2Bucket,
    KV: {
      get: vi.fn(),
      getWithMetadata: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
      list: vi.fn(),
    } as unknown as KVNamespace,
    Capture_Rate_Limits: {
      get: vi.fn(),
      getWithMetadata: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
      list: vi.fn(),
    } as unknown as KVNamespace,
    POST_VECTORS: {
      get: vi.fn(),
      getWithMetadata: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
      list: vi.fn(),
    } as unknown as KVNamespace,
    USER_VECTORS: {
      get: vi.fn(),
      getWithMetadata: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
      list: vi.fn(),
    } as unknown as KVNamespace,
    VECTORIZE: {
      insert: vi.fn(),
      upsert: vi.fn(),
      query: vi.fn(),
      getByIds: vi.fn(),
      deleteByIds: vi.fn(),
    } as unknown as VectorizeIndex,
    CLOUDFLARE_ACCOUNT_ID: 'mock-cf-account-id',
    CLOUDFLARE_ACCOUNT_HASH: 'mock-cf-account-hash',
    CLOUDFLARE_IMAGES_TOKEN: 'mock-cf-images-token',
    CLOUDFLARE_IMAGES_KEY: 'mock-cf-images-key',
    SEED_SECRET: 'mock-seed-secret',
    AI: { run: vi.fn() } as unknown as Ai,
    POST_QUEUE: {
      send: vi.fn(),
      sendBatch: vi.fn(),
    } as unknown as Queue<{ postId: string }>,
    USER_VECTOR_QUEUE: {
      send: vi.fn(),
      sendBatch: vi.fn(),
    } as unknown as Queue<{ userId: string }>,
    DO: {
      open: vi.fn().mockResolvedValue({
        id: 'test-id',
        stub: {} as DurableObjectStub,
      }),
    } as unknown as DurableObjectNamespace,
  };
  return bindings;
}

export function createTestFile(
  options: {
    name?: string;
    type?: string;
    size?: number;
  } = {},
) {
  const content = options.size ? new Uint8Array(options.size).fill(65) : 'test-content';

  return new File([content], options.name || `test-${nanoid()}.jpg`, {
    type: options.type || 'image/jpeg',
  });
}

export function createFormData(file: File) {
  const formData = new FormData();
  formData.append('file', file);
  return formData;
}
