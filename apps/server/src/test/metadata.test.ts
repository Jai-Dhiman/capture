import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MetadataService } from '../lib/images/metadataService';
import { ImageSearchService } from '../lib/images/searchService';
import { BulkOperationsService } from '../lib/images/bulkOperationsService';
import type { ImageMetadata, ImageVariant, ImageTransformation } from '../lib/images/metadata';

// Mock environment for testing
const mockEnv = {
  IMAGE_STORAGE: {
    head: () => Promise.resolve({ customMetadata: {} }),
    put: () => Promise.resolve(),
    delete: () => Promise.resolve()
  },
  METADATA_KV: {
    get: () => Promise.resolve(null),
    put: () => Promise.resolve(),
    delete: () => Promise.resolve(),
    list: () => Promise.resolve({ keys: [] })
  },
  CACHE_KV: {
    get: () => Promise.resolve(null),
    put: () => Promise.resolve(),
    delete: () => Promise.resolve(),
    list: () => Promise.resolve({ keys: [] })
  }
} as any;

describe('MetadataService', () => {
  let metadataService: MetadataService;
  
  beforeEach(() => {
    metadataService = new MetadataService(mockEnv);
  });

  describe('metadata validation', () => {
    it('should validate required fields', async () => {
      const invalidMetadata = {} as ImageMetadata;
      
      try {
        await metadataService.storeMetadata('test-id', invalidMetadata);
        expect.fail('Should have thrown validation error');
      } catch (error) {
        expect(error instanceof Error).toBe(true);
        expect((error as Error).message).toContain('Invalid metadata');
      }
    });

    it('should accept valid metadata', async () => {
      const validMetadata: ImageMetadata = {
        id: 'test-image-123',
        filename: 'test.jpg',
        originalName: 'test.jpg',
        size: 102400,
        mimeType: 'image/jpeg',
        format: 'jpeg',
        width: 1920,
        height: 1080,
        aspectRatio: 1.78,
        orientation: 1,
        quality: 85,
        bitDepth: 8,
        colorSpace: 'sRGB',
        hasAlpha: false,
        isProcessed: false,
        variants: [],
        transformations: [],
        userId: 'user-123',
        uploadedAt: new Date().toISOString(),
        uploadedBy: 'user-123',
        visibility: 'private',
        tags: ['test', 'sample'],
        storageKey: 'images/test.jpg',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await expect(metadataService.storeMetadata('test-id', validMetadata)).resolves.not.toThrow();
    });
  });

  describe('metadata extraction', () => {
    it('should extract basic metadata from filename', async () => {
      const metadata = await metadataService.extractMetadataFromFile(
        new Uint8Array([0x89, 0x50, 0x4E, 0x47]), // PNG header
        'test-image.png',
        'user-123'
      );

      expect(metadata.filename).toBe('test-image.png');
      expect(metadata.originalName).toBe('test-image.png');
      expect(metadata.mimeType).toBe('image/png');
      expect(metadata.format).toBe('png');
      expect(metadata.userId).toBe('user-123');
      expect(metadata.size).toBe(4);
    });

    it('should detect JPEG format', async () => {
      const metadata = await metadataService.extractMetadataFromFile(
        new Uint8Array([0xFF, 0xD8, 0xFF]), // JPEG header
        'photo.jpg',
        'user-456'
      );

      expect(metadata.mimeType).toBe('image/jpeg');
      expect(metadata.format).toBe('jpeg');
    });

    it('should handle unknown formats', async () => {
      const metadata = await metadataService.extractMetadataFromFile(
        new Uint8Array([0x00, 0x00, 0x00]),
        'unknown.xyz',
        'user-789'
      );

      expect(metadata.mimeType).toBe('application/octet-stream');
      expect(metadata.format).toBe('unknown');
    });
  });

  describe('variant management', () => {
    it('should add variants to metadata', async () => {
      const metadata: ImageMetadata = {
        id: 'test-image',
        variants: [],
        // ... other required fields
      } as ImageMetadata;

      // Mock getting existing metadata
      metadataService.getMetadata = async () => metadata;
      metadataService.storeMetadata = async () => {};

      const variant: ImageVariant = {
        id: 'test-image-small',
        name: 'small',
        storageKey: 'images/test-image-small.webp',
        width: 400,
        height: 300,
        size: 25600,
        format: 'webp',
        quality: 80,
        createdAt: new Date().toISOString()
      };

      await metadataService.addVariant('test-image', variant);
      
      expect(metadata.variants).toContain(variant);
    });

    it('should replace existing variant with same name', async () => {
      const existingVariant: ImageVariant = {
        id: 'test-image-small-old',
        name: 'small',
        storageKey: 'images/old-small.webp',
        width: 300,
        height: 200,
        size: 20000,
        format: 'webp',
        quality: 70,
        createdAt: new Date().toISOString()
      };

      const metadata: ImageMetadata = {
        id: 'test-image',
        variants: [existingVariant],
        // ... other required fields
      } as ImageMetadata;

      metadataService.getMetadata = async () => metadata;
      metadataService.storeMetadata = async () => {};

      const newVariant: ImageVariant = {
        id: 'test-image-small-new',
        name: 'small',
        storageKey: 'images/new-small.webp',
        width: 400,
        height: 300,
        size: 25600,
        format: 'webp',
        quality: 80,
        createdAt: new Date().toISOString()
      };

      await metadataService.addVariant('test-image', newVariant);
      
      expect(metadata.variants.length).toBe(1);
      expect(metadata.variants[0]).toEqual(newVariant);
    });
  });

  describe('transformation tracking', () => {
    it('should track image transformations', async () => {
      const metadata: ImageMetadata = {
        id: 'test-image',
        transformations: [],
        isProcessed: false,
        // ... other required fields
      } as ImageMetadata;

      metadataService.getMetadata = async () => metadata;
      metadataService.storeMetadata = async () => {};

      const transformation: ImageTransformation = {
        id: 'transform-123',
        type: 'resize',
        parameters: { width: 800, height: 600 },
        appliedAt: new Date().toISOString(),
        appliedBy: 'user-123'
      };

      await metadataService.addTransformation('test-image', transformation);
      
      expect(metadata.transformations).toContain(transformation);
      expect(metadata.isProcessed).toBe(true);
    });
  });
});

describe('ImageSearchService', () => {
  let searchService: ImageSearchService;
  
  beforeEach(() => {
    searchService = new ImageSearchService(mockEnv);
  });

  describe('tag-based search', () => {
    it('should search images by tags', async () => {
      // Mock KV data
      const mockTagData = JSON.stringify(['image1', 'image2', 'image3']);
      mockEnv.METADATA_KV.get = async (key: string) => {
        if (key === 'tag:nature') return mockTagData;
        return null;
      };

      const results = await searchService.searchByTags(['nature']);
      
      expect(results).toEqual(['image1', 'image2', 'image3']);
    });

    it('should handle non-existent tags', async () => {
      mockEnv.METADATA_KV.get = async () => null;

      const results = await searchService.searchByTags(['nonexistent']);
      
      expect(results).toEqual([]);
    });
  });

  describe('user-based search', () => {
    it('should search images by user', async () => {
      const mockUserData = JSON.stringify(['user-image1', 'user-image2']);
      mockEnv.METADATA_KV.get = async (key: string) => {
        if (key === 'user:user-123') return mockUserData;
        return null;
      };

      const results = await searchService.searchByUser('user-123');
      
      expect(results).toEqual(['user-image1', 'user-image2']);
    });

    it('should handle pagination', async () => {
      const mockUserData = JSON.stringify(['img1', 'img2', 'img3', 'img4', 'img5']);
      mockEnv.METADATA_KV.get = async () => mockUserData;

      const results = await searchService.searchByUser('user-123', {
        limit: 2,
        offset: 1
      });
      
      expect(results).toEqual(['img2', 'img3']);
    });
  });
});

describe('BulkOperationsService', () => {
  let bulkService: BulkOperationsService;
  
  beforeEach(() => {
    bulkService = new BulkOperationsService(mockEnv);
  });

  describe('bulk tagging', () => {
    it('should add tags to multiple images', async () => {
      const mockMetadata: ImageMetadata = {
        id: 'test-image',
        tags: ['existing'],
        // ... other fields
      } as ImageMetadata;

      // Mock metadata service methods
      bulkService['metadataService'].getMetadata = async () => mockMetadata;
      bulkService['metadataService'].updateMetadata = async () => {};

      const operation = {
        type: 'tag' as const,
        imageIds: ['image1', 'image2'],
        parameters: { tags: ['new-tag1', 'new-tag2'] },
        userId: 'user-123',
        requestedAt: new Date().toISOString()
      };

      const result = await bulkService.executeBulkOperation(operation);
      
      expect(result.successCount).toBe(2);
      expect(result.failureCount).toBe(0);
      expect(result.errors.length).toBe(0);
    });

    it('should handle failures gracefully', async () => {
      bulkService['metadataService'].getMetadata = async () => null; // Simulate not found

      const operation = {
        type: 'tag' as const,
        imageIds: ['nonexistent'],
        parameters: { tags: ['new-tag'] },
        userId: 'user-123',
        requestedAt: new Date().toISOString()
      };

      const result = await bulkService.executeBulkOperation(operation);
      
      expect(result.successCount).toBe(0);
      expect(result.failureCount).toBe(1);
      expect(result.errors.length).toBe(1);
      expect(result.errors[0].error).toBe('Metadata not found');
    });
  });

  describe('bulk categorization', () => {
    it('should categorize multiple images', async () => {
      const mockMetadata: ImageMetadata = {
        id: 'test-image',
        category: 'old-category',
        // ... other fields
      } as ImageMetadata;

      bulkService['metadataService'].getMetadata = async () => mockMetadata;
      bulkService['metadataService'].updateMetadata = async () => {};

      const operation = {
        type: 'categorize' as const,
        imageIds: ['image1', 'image2'],
        parameters: { category: 'photography' },
        userId: 'user-123',
        requestedAt: new Date().toISOString()
      };

      const result = await bulkService.executeBulkOperation(operation);
      
      expect(result.successCount).toBe(2);
      expect(result.failureCount).toBe(0);
    });
  });

  describe('bulk visibility updates', () => {
    it('should update visibility for multiple images', async () => {
      bulkService['metadataService'].updateMetadata = async () => {};

      const result = await bulkService.bulkUpdateVisibility(
        ['image1', 'image2', 'image3'],
        'public',
        'user-123'
      );
      
      expect(result.successCount).toBe(3);
      expect(result.failureCount).toBe(0);
    });
  });
});