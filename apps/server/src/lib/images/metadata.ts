/**
 * Image metadata management types and interfaces
 */

export interface ImageMetadata {
  // Basic image properties
  id: string;
  filename: string;
  originalName: string;
  size: number;
  mimeType: string;
  format: string;
  
  // Dimensions and visual properties
  width: number;
  height: number;
  aspectRatio: number;
  orientation: number;
  
  // Quality and technical details
  quality: number;
  bitDepth: number;
  colorSpace: string;
  hasAlpha: boolean;
  
  // Processing and transformation metadata
  isProcessed: boolean;
  originalImageId?: string;
  variants: ImageVariant[];
  transformations: ImageTransformation[];
  
  // User and context metadata
  userId: string;
  uploadedAt: string;
  uploadedBy: string;
  visibility: 'public' | 'private' | 'unlisted';
  
  // Categorization and discovery
  tags: string[];
  category?: string;
  description?: string;
  altText?: string;
  
  // Storage and CDN metadata
  storageKey: string;
  cdn?: {
    urls: Record<string, string>;
    cacheStatus: 'cached' | 'purged' | 'pending';
    lastCacheUpdate: string;
  };
  
  // Performance and analytics
  analytics?: {
    views: number;
    downloads: number;
    bandwidth: number;
    lastAccessed: string;
  };
  
  // Security and compliance
  contentValidation?: {
    isValidated: boolean;
    virusScanned: boolean;
    contentType: 'safe' | 'flagged' | 'pending';
    moderationFlags: string[];
  };
  
  // EXIF and camera metadata (if available)
  exif?: ExifData;
  
  // Timestamps
  createdAt: string;
  updatedAt: string;
}

export interface ImageVariant {
  id: string;
  name: string;
  storageKey: string;
  width: number;
  height: number;
  size: number;
  format: string;
  quality: number;
  createdAt: string;
}

export interface ImageTransformation {
  id: string;
  type: 'resize' | 'crop' | 'rotate' | 'filter' | 'enhancement';
  parameters: Record<string, any>;
  appliedAt: string;
  appliedBy: string;
}

export interface ExifData {
  make?: string;
  model?: string;
  lens?: string;
  exposureTime?: string;
  fNumber?: string;
  iso?: number;
  focalLength?: string;
  flash?: string;
  orientation?: number;
  dateTime?: string;
  gpsLatitude?: number;
  gpsLongitude?: number;
  gpsAltitude?: number;
}

export interface MetadataSearchQuery {
  // Basic search parameters
  query?: string;
  tags?: string[];
  userId?: string;
  category?: string;
  visibility?: 'public' | 'private' | 'unlisted';
  
  // Size and dimension filters
  minWidth?: number;
  maxWidth?: number;
  minHeight?: number;
  maxHeight?: number;
  minSize?: number;
  maxSize?: number;
  
  // Date range filters
  uploadedAfter?: string;
  uploadedBefore?: string;
  
  // Format and quality filters
  formats?: string[];
  minQuality?: number;
  maxQuality?: number;
  
  // Processing filters
  isProcessed?: boolean;
  hasVariants?: boolean;
  
  // Sorting and pagination
  sortBy?: 'uploadedAt' | 'size' | 'views' | 'downloads' | 'relevance';
  sortOrder?: 'asc' | 'desc';
  offset?: number;
  limit?: number;
}

export interface MetadataSearchResult {
  results: ImageMetadata[];
  total: number;
  offset: number;
  limit: number;
  hasMore: boolean;
  facets?: {
    formats: Array<{ value: string; count: number }>;
    tags: Array<{ value: string; count: number }>;
    categories: Array<{ value: string; count: number }>;
    sizes: Array<{ range: string; count: number }>;
  };
}

export interface BulkMetadataOperation {
  type: 'update' | 'delete' | 'tag' | 'categorize';
  imageIds: string[];
  parameters: Record<string, any>;
  userId: string;
  requestedAt: string;
}

export interface BulkOperationResult {
  operationId: string;
  totalItems: number;
  successCount: number;
  failureCount: number;
  errors: Array<{ imageId: string; error: string }>;
  completedAt: string;
}

// Utility types for metadata validation
export interface MetadataValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface MetadataStorageConfig {
  useR2CustomMetadata: boolean;
  useWorkersKV: boolean;
  kvNamespace: string;
  cacheTTL: number;
  enableSearch: boolean;
  enableAnalytics: boolean;
}