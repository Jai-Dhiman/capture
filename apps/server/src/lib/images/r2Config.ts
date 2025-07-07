export const R2_CONFIG = {
  // Bucket configuration
  bucketName: 'capture-images',
  
  // CORS configuration for web access
  corsPolicy: {
    AllowedOrigins: ['*'], // Should be restricted to your domain in production
    AllowedMethods: ['GET', 'PUT', 'POST', 'DELETE', 'HEAD'],
    AllowedHeaders: ['*'],
    ExposeHeaders: ['ETag', 'x-amz-version-id'],
    MaxAgeSeconds: 3600,
  },

  // Storage settings
  storage: {
    // Standard storage for frequently accessed images
    defaultStorageClass: 'Standard',
    
    // Lifecycle rules for cost optimization
    lifecycleRules: {
      // Transition older images to Infrequent Access after 30 days
      transitionToIA: {
        days: 30,
        storageClass: 'InfrequentAccess',
      },
      
      // Delete temporary upload URLs after 1 day if not used
      deleteAbandoned: {
        days: 1,
        prefix: 'temp/',
      },
    },
  },

  // Upload configuration
  upload: {
    // Maximum file size (10MB)
    maxFileSize: 10 * 1024 * 1024,
    
    // Allowed file types
    allowedMimeTypes: [
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/heic',
      'image/heif',
    ],
    
    // Presigned URL expiry (1 hour)
    presignedUrlExpiry: 3600,
    
    // Download URL expiry (30 minutes for public access)
    downloadUrlExpiry: 1800,
  },

  // Image variants for optimization
  variants: {
    thumbnail: { width: 150, height: 150, quality: 80 },
    small: { width: 320, height: 320, quality: 85 },
    medium: { width: 640, height: 640, quality: 90 },
    large: { width: 1280, height: 1280, quality: 95 },
    original: { quality: 100 },
  },

  // Security settings
  security: {
    // Enable encryption at rest
    encryption: true,
    
    // Content-Type validation
    validateContentType: true,
    
    // File signature validation
    validateFileSignature: true,
  },
} as const;

export type R2ConfigType = typeof R2_CONFIG;