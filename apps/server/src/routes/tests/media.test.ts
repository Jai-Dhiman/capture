import { describe, expect, it, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import type { Bindings, Variables } from '../../types/index.js';
import mediaRouter from '../media.js';

// Mock the image service
const mockGetUploadUrl = vi.fn();
const mockGetBatchUploadUrls = vi.fn();
const mockCreate = vi.fn();
const mockCreateBatch = vi.fn();
const mockProcessEditedImage = vi.fn();
const mockOptimizeForVariants = vi.fn();
const mockFindByIdPublic = vi.fn();
const mockFindById = vi.fn();
const mockGetImageUrl = vi.fn();
const mockDelete = vi.fn();
const mockDeleteBatch = vi.fn();
const mockPurgeCDNCache = vi.fn();
const mockGetDirectCloudflareUrl = vi.fn();
const mockGetProcessorStatus = vi.fn();
const mockClearProcessorMemory = vi.fn();
const mockCanProcessMore = vi.fn();

vi.mock('../../lib/images/imageService.js', () => ({
  createImageService: vi.fn(() => ({
    getUploadUrl: mockGetUploadUrl,
    getBatchUploadUrls: mockGetBatchUploadUrls,
    create: mockCreate,
    createBatch: mockCreateBatch,
    processEditedImage: mockProcessEditedImage,
    optimizeForVariants: mockOptimizeForVariants,
    findByIdPublic: mockFindByIdPublic,
    findById: mockFindById,
    getImageUrl: mockGetImageUrl,
    delete: mockDelete,
    deleteBatch: mockDeleteBatch,
    purgeCDNCache: mockPurgeCDNCache,
    getDirectCloudflareUrl: mockGetDirectCloudflareUrl,
    getProcessorStatus: mockGetProcessorStatus,
    clearProcessorMemory: mockClearProcessorMemory,
    canProcessMore: mockCanProcessMore,
  })),
}));

// Mock the caching service
const mockCacheGet = vi.fn();
const mockCacheSet = vi.fn();
const mockCacheDelete = vi.fn();
const mockInvalidatePattern = vi.fn();

vi.mock('../../lib/cache/cachingService.js', () => ({
  createCachingService: vi.fn(() => ({
    get: mockCacheGet,
    set: mockCacheSet,
    delete: mockCacheDelete,
    invalidatePattern: mockInvalidatePattern,
  })),
  CacheKeys: {
    cdnUrl: vi.fn((mediaId, variant, format) => `cdn_url:${mediaId}:${variant}:${format}`),
    media: vi.fn((mediaId) => `media:${mediaId}`),
    cdnUrlPattern: vi.fn((mediaId) => `cdn_url:${mediaId}:*`),
    mediaUrlPattern: vi.fn((storageKey) => `media_url:${storageKey}:*`),
  },
  CacheTTL: {
    MEDIA: 3600,
  },
}));

// Mock security middleware
vi.mock('../../middleware/security.js', () => ({
  cdnSecurityHeaders: vi.fn(() => (c: any, next: any) => next()),
}));

// Mock D1 client and schema for soft-delete endpoints
const mockDbSelect = vi.fn();
const mockDbUpdate = vi.fn();
const mockDbDelete = vi.fn();
const mockDbFrom = vi.fn();
const mockDbWhere = vi.fn();
const mockDbGet = vi.fn();
const mockDbSet = vi.fn();

vi.mock('../../db/index.js', () => ({
  createD1Client: vi.fn(() => ({
    select: mockDbSelect,
    update: mockDbUpdate,
    delete: mockDbDelete,
  })),
}));

vi.mock('../../db/schema.js', () => ({
  media: {
    id: 'id',
    userId: 'user_id',
    deletedAt: 'deleted_at',
    storageKey: 'storage_key',
  },
}));

describe('Media Routes', () => {
  let app: Hono<{ Bindings: Bindings; Variables: Variables }>;
  let mockEnv: Bindings;
  const mockUser = { id: 'test-user-id', email: 'test@example.com' };

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockEnv = {
      DB: {} as any,
      CAPTURE_KV: {} as any,
      POST_QUEUE: {} as any,
      USER_VECTOR_QUEUE: {} as any,
      VOYAGE_API_KEY: 'test-key',
      QDRANT_URL: 'test-url',
      QDRANT_API_KEY: 'test-key',
      QDRANT_COLLECTION_NAME: 'test-collection',
    } as any;

    app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

    // Set up environment and user in context
    app.use('*', async (c, next) => {
      c.env = mockEnv;
      c.set('user', mockUser as any);
      await next();
    });

    app.route('/media', mediaRouter);
  });

  describe('POST /image-upload', () => {
    it('should generate an upload URL successfully', async () => {
      const mockUploadData = {
        uploadURL: 'https://example.com/upload',
        id: 'test-image-id',
      };
      mockGetUploadUrl.mockResolvedValue(mockUploadData);

      const res = await app.request('/media/image-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contentType: 'image/jpeg', fileSize: 1024 }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toEqual(mockUploadData);
      expect(mockGetUploadUrl).toHaveBeenCalledWith('test-user-id', 'user', 'image/jpeg', 1024);
    });

    it('should return 401 when user is not authenticated', async () => {
      const appWithoutUser = new Hono<{ Bindings: Bindings; Variables: Variables }>();
      appWithoutUser.use('*', async (c, next) => {
        c.env = mockEnv;
        await next();
      });
      appWithoutUser.route('/media', mediaRouter);

      const res = await appWithoutUser.request('/media/image-upload', {
        method: 'POST',
      });

      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data).toEqual({ error: 'User not authenticated' });
    });

    it('should handle rate limit errors', async () => {
      mockGetUploadUrl.mockRejectedValue(new Error('Rate limit exceeded'));

      const res = await app.request('/media/image-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(429);
      const data = await res.json();
      expect(data).toEqual({ error: 'Rate limit exceeded' });
    });
  });

  describe('POST /batch-upload', () => {
    it('should generate batch upload URLs successfully', async () => {
      const mockBatchUrls = {
        uploads: [
          { uploadURL: 'https://example.com/upload1', id: 'id1' },
          { uploadURL: 'https://example.com/upload2', id: 'id2' },
        ],
      };
      mockGetBatchUploadUrls.mockResolvedValue(mockBatchUrls.uploads);

      const res = await app.request('/media/batch-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count: 2, contentType: 'image/jpeg' }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toEqual(mockBatchUrls);
      expect(mockGetBatchUploadUrls).toHaveBeenCalledWith('test-user-id', 'user', 2, 'image/jpeg');
    });

    it('should return 400 for invalid count', async () => {
      const res = await app.request('/media/batch-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count: 15 }),
      });

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data).toEqual({ error: 'Count must be between 1 and 10' });
    });
  });

  describe('POST /image-record', () => {
    it('should create a media record successfully', async () => {
      const mockMedia = {
        id: 'test-media-id',
        userId: 'test-user-id',
        storageKey: 'test-storage-key',
        type: 'image',
        order: 1,
      };
      mockCreate.mockResolvedValue(mockMedia);
      mockGetImageUrl.mockResolvedValue('https://example.com/image.jpg');

      const res = await app.request('/media/image-record', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageId: 'test-image-id',
          order: 1,
          postId: 'test-post-id',
        }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toEqual({
        media: {
          ...mockMedia,
          url: 'https://example.com/image.jpg',
        },
      });
    });

    it('should return 400 when imageId is missing', async () => {
      const res = await app.request('/media/image-record', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order: 1 }),
      });

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data).toEqual({ error: 'Image ID is required' });
    });
  });

  describe('POST /batch-records', () => {
    it('should create batch media records successfully', async () => {
      const mockMediaItems = [
        { id: 'media1', storageKey: 'key1' },
        { id: 'media2', storageKey: 'key2' },
      ];
      mockCreateBatch.mockResolvedValue(mockMediaItems);
      mockGetImageUrl.mockResolvedValue('https://example.com/image.jpg');

      const res = await app.request('/media/batch-records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mediaItems: [
            { imageId: 'img1', order: 0 },
            { imageId: 'img2', order: 1 },
          ],
        }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.media).toHaveLength(2);
      expect(data.media[0]).toHaveProperty('url');
    });

    it('should return 400 for empty media items', async () => {
      const res = await app.request('/media/batch-records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mediaItems: [] }),
      });

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data).toEqual({ error: 'Media items array is required' });
    });
  });

  describe('GET /:mediaId/url', () => {
    it('should return image URL successfully', async () => {
      const mockMedia = {
        id: 'test-media-id',
        storageKey: 'test-storage-key',
      };
      mockFindByIdPublic.mockResolvedValue(mockMedia);
      mockGetImageUrl.mockResolvedValue('https://example.com/image.jpg');

      const res = await app.request('/media/test-media-id/url');

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toEqual({ url: 'https://example.com/image.jpg' });
    });

    it('should return 404 when media not found', async () => {
      mockFindByIdPublic.mockResolvedValue(null);

      const res = await app.request('/media/test-media-id/url');

      expect(res.status).toBe(404);
      const data = await res.json();
      expect(data).toEqual({ error: 'Media not found' });
    });

    it('should respect custom expiry parameter', async () => {
      const mockMedia = {
        id: 'test-media-id',
        storageKey: 'test-storage-key',
      };
      mockFindByIdPublic.mockResolvedValue(mockMedia);
      mockGetImageUrl.mockResolvedValue('https://example.com/image.jpg');

      const res = await app.request('/media/test-media-id/url?expiry=3600');

      expect(res.status).toBe(200);
      expect(mockGetImageUrl).toHaveBeenCalledWith('test-storage-key', 'public', 3600);
    });
  });

  describe('DELETE /:mediaId', () => {
    it('should soft-delete media by default', async () => {
      const mockMedia = {
        id: 'test-media-id',
        userId: 'test-user-id',
        storageKey: 'test-key',
      };
      mockDbSelect.mockReturnValue({ from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ get: vi.fn().mockResolvedValue(mockMedia) }) }) });
      mockDbUpdate.mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }) });

      const res = await app.request('/media/test-media-id', {
        method: 'DELETE',
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toHaveProperty('success', true);
      expect(data).toHaveProperty('message', 'Media soft-deleted');
    });

    it('should permanently delete when permanent=true', async () => {
      const mockResult = { success: true, deletedFiles: 1 };
      mockDelete.mockResolvedValue(mockResult);

      const res = await app.request('/media/test-media-id?permanent=true', {
        method: 'DELETE',
      });

      expect(res.status).toBe(200);
      expect(mockDelete).toHaveBeenCalledWith('test-media-id', 'test-user-id', 'user', {
        permanent: true,
        softDelete: false,
      });
    });
  });

  describe('GET /cloudflare-url/:cloudflareId', () => {
    it('should return direct Cloudflare URL successfully', async () => {
      mockGetDirectCloudflareUrl.mockResolvedValue('https://cloudflare.com/image.jpg');

      const res = await app.request('/media/cloudflare-url/test-cloudflare-id');

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toEqual({ url: 'https://cloudflare.com/image.jpg' });
      expect(mockGetDirectCloudflareUrl).toHaveBeenCalledWith('test-cloudflare-id', 'public', 1800);
    });
  });

  describe('POST /transform/:mediaId', () => {
    it('should transform image successfully', async () => {
      const mockResult = {
        processedImageId: 'processed-id',
        variants: ['thumbnail', 'medium'],
        originalSize: 1024,
        processedSize: 512,
      };
      mockProcessEditedImage.mockResolvedValue(mockResult);

      const res = await app.request('/media/transform/test-media-id', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transformParams: { brightness: 1.2, contrast: 1.1 },
        }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toEqual(mockResult);
    });

    it('should return 400 when transform parameters are missing', async () => {
      const res = await app.request('/media/transform/test-media-id', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data).toEqual({ error: 'Transform parameters are required' });
    });
  });

  describe('GET /cdn/*', () => {
    it('should redirect to new /cdn/* path', async () => {
      const res = await app.request('/media/cdn/test-media-id');

      expect(res.status).toBe(301);
      const location = res.headers.get('location');
      expect(location).toContain('/cdn/test-media-id');
    });

    it('should redirect seed images to new /cdn/* path', async () => {
      const res = await app.request('/media/cdn/seed-images/photo-27.jpg');

      expect(res.status).toBe(301);
      const location = res.headers.get('location');
      expect(location).toContain('/cdn/seed-images/photo-27.jpg');
    });
  });

  describe('POST /purge-cache/:mediaId', () => {
    it('should purge cache successfully', async () => {
      const mockMedia = {
        id: 'test-media-id',
        storageKey: 'test-storage-key',
      };
      mockFindById.mockResolvedValue(mockMedia);
      mockPurgeCDNCache.mockResolvedValue({ urls: ['url1', 'url2'] });

      const res = await app.request('/media/purge-cache/test-media-id', {
        method: 'POST',
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toHaveProperty('success', true);
      expect(data).toHaveProperty('purgedUrls', ['url1', 'url2']);
    });
  });

  describe('GET /processor-status', () => {
    it('should return processor status', async () => {
      const mockStatus = { 
        isRunning: true, 
        queueLength: 5, 
        memoryUsage: '128MB' 
      };
      mockGetProcessorStatus.mockReturnValue(mockStatus);

      const res = await app.request('/media/processor-status');

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toEqual({ status: mockStatus });
    });
  });

  describe('POST /batch-transform', () => {
    it('should process batch transforms successfully', async () => {
      mockCanProcessMore.mockReturnValue(true);
      mockProcessEditedImage.mockResolvedValue({
        processedImageId: 'processed-id',
        variants: ['thumbnail'],
      });

      const res = await app.request('/media/batch-transform', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transforms: [
            { mediaId: 'media1', transformParams: { brightness: 1.2 } },
            { mediaId: 'media2', transformParams: { contrast: 1.1 } },
          ],
        }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toHaveProperty('total', 2);
      expect(data).toHaveProperty('successCount', 2);
      expect(data).toHaveProperty('failureCount', 0);
    });

    it('should return 503 when processor is at capacity', async () => {
      mockCanProcessMore.mockReturnValue(false);

      const res = await app.request('/media/batch-transform', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transforms: [{ mediaId: 'media1', transformParams: {} }],
        }),
      });

      expect(res.status).toBe(503);
      const data = await res.json();
      expect(data).toEqual({ error: 'Processor is at capacity, please try again later' });
    });
  });
});