import type { Bindings } from '@/types';

export interface EdgeTransformationOptions {
  // Image transformations
  width?: number;
  height?: number;
  quality?: number;
  format?: 'webp' | 'jpeg' | 'png' | 'avif';
  fit?: 'scale-down' | 'contain' | 'cover' | 'crop' | 'pad';
  
  // Content transformations
  compress?: boolean;
  minify?: boolean;
  
  // Personalization
  userId?: string;
  userAgent?: string;
  acceptLanguage?: string;
  
  // A/B testing
  variant?: string;
  experimentId?: string;
}

export interface EdgeTransformationService {
  transformImage: (imageUrl: string, options: EdgeTransformationOptions) => Promise<string>;
  transformContent: (content: string, options: EdgeTransformationOptions) => Promise<string>;
  personalizeContent: (content: any, options: EdgeTransformationOptions) => Promise<any>;
  handleABTest: (content: any, options: EdgeTransformationOptions) => Promise<any>;
  getCacheKey: (originalKey: string, options: EdgeTransformationOptions) => string;
}

export function createEdgeTransformationService(env: Bindings): EdgeTransformationService {
  return {
    async transformImage(imageUrl: string, options: EdgeTransformationOptions): Promise<string> {
      try {
        // Use Cloudflare Images if available
        if (env.CLOUDFLARE_ACCOUNT_HASH && env.CLOUDFLARE_IMAGES_TOKEN) {
          const transformParams = new URLSearchParams();
          
          if (options.width) transformParams.set('width', options.width.toString());
          if (options.height) transformParams.set('height', options.height.toString());
          if (options.quality) transformParams.set('quality', options.quality.toString());
          if (options.format) transformParams.set('format', options.format);
          if (options.fit) transformParams.set('fit', options.fit);
          
          // Extract image ID from URL or use as-is
          const imageId = imageUrl.split('/').pop() || imageUrl;
          
          return `https://imagedelivery.net/${env.CLOUDFLARE_ACCOUNT_HASH}/${imageId}/${transformParams.toString()}`;
        }
        
        // Fallback to original URL
        return imageUrl;
      } catch (error) {
        console.error('Image transformation error:', error);
        return imageUrl;
      }
    },

    async transformContent(content: string, options: EdgeTransformationOptions): Promise<string> {
      try {
        let transformedContent = content;
        
        // Minify HTML/CSS/JS if requested
        if (options.minify) {
          transformedContent = transformedContent
            .replace(/\s+/g, ' ')
            .replace(/<!--[\s\S]*?-->/g, '')
            .trim();
        }
        
        // Compress content if requested
        if (options.compress) {
          // Note: In a real Cloudflare Worker, you'd use the built-in compression
          // This is a placeholder for the compression logic
          transformedContent = transformedContent;
        }
        
        return transformedContent;
      } catch (error) {
        console.error('Content transformation error:', error);
        return content;
      }
    },

    async personalizeContent(content: any, options: EdgeTransformationOptions): Promise<any> {
      try {
        if (!options.userId) {
          return content;
        }
        
        // Personalize content based on user preferences
        const personalizedContent = { ...content };
        
        // Add user-specific metadata
        if (typeof personalizedContent === 'object') {
          personalizedContent._personalized = true;
          personalizedContent._userId = options.userId;
          personalizedContent._timestamp = new Date().toISOString();
          
          // Apply user-specific transformations
          if (options.userAgent?.includes('Mobile')) {
            personalizedContent._mobileOptimized = true;
          }
          
          if (options.acceptLanguage) {
            personalizedContent._locale = options.acceptLanguage.split(',')[0];
          }
        }
        
        return personalizedContent;
      } catch (error) {
        console.error('Content personalization error:', error);
        return content;
      }
    },

    async handleABTest(content: any, options: EdgeTransformationOptions): Promise<any> {
      try {
        if (!options.experimentId || !options.variant) {
          return content;
        }
        
        const testContent = { ...content };
        
        // Apply A/B test variations
        if (typeof testContent === 'object') {
          testContent._experiment = {
            id: options.experimentId,
            variant: options.variant,
            appliedAt: new Date().toISOString(),
          };
          
          // Apply variant-specific transformations
          switch (options.variant) {
            case 'variant_a':
              testContent._variantA = true;
              break;
            case 'variant_b':
              testContent._variantB = true;
              break;
            default:
              testContent._control = true;
          }
        }
        
        return testContent;
      } catch (error) {
        console.error('A/B test handling error:', error);
        return content;
      }
    },

    getCacheKey(originalKey: string, options: EdgeTransformationOptions): string {
      const keyParts = [originalKey];
      
      // Add transformation parameters to cache key
      if (options.width) keyParts.push(`w${options.width}`);
      if (options.height) keyParts.push(`h${options.height}`);
      if (options.quality) keyParts.push(`q${options.quality}`);
      if (options.format) keyParts.push(`f${options.format}`);
      if (options.fit) keyParts.push(`fit${options.fit}`);
      
      // Add personalization parameters
      if (options.userId) keyParts.push(`u${options.userId}`);
      if (options.userAgent?.includes('Mobile')) keyParts.push('mobile');
      if (options.acceptLanguage) keyParts.push(`lang${options.acceptLanguage.split(',')[0]}`);
      
      // Add A/B test parameters
      if (options.experimentId) keyParts.push(`exp${options.experimentId}`);
      if (options.variant) keyParts.push(`var${options.variant}`);
      
      return keyParts.join(':');
    },
  };
}

// Edge transformation utilities
export const EdgeTransformations = {
  // Common image transformation presets
  thumbnails: {
    small: { width: 150, height: 150, fit: 'cover' as const, quality: 85 },
    medium: { width: 300, height: 300, fit: 'cover' as const, quality: 85 },
    large: { width: 600, height: 600, fit: 'cover' as const, quality: 90 },
  },
  
  // Content optimization presets
  optimization: {
    mobile: { minify: true, compress: true },
    desktop: { minify: false, compress: true },
  },
  
  // A/B test configurations
  experiments: {
    feedAlgorithm: {
      experimentId: 'feed_algorithm_v2',
      variants: ['control', 'variant_a', 'variant_b'],
    },
    imageQuality: {
      experimentId: 'image_quality_test',
      variants: ['high_quality', 'standard_quality', 'low_quality'],
    },
  },
} as const;

// Helper function to extract transformation options from request
export function extractTransformationOptions(request: Request): EdgeTransformationOptions {
  const url = new URL(request.url);
  const searchParams = url.searchParams;
  
  return {
    // Image transformations
    width: searchParams.get('w') ? parseInt(searchParams.get('w')!) : undefined,
    height: searchParams.get('h') ? parseInt(searchParams.get('h')!) : undefined,
    quality: searchParams.get('q') ? parseInt(searchParams.get('q')!) : undefined,
    format: searchParams.get('f') as EdgeTransformationOptions['format'],
    fit: searchParams.get('fit') as EdgeTransformationOptions['fit'],
    
    // Content transformations
    compress: searchParams.get('compress') === 'true',
    minify: searchParams.get('minify') === 'true',
    
    // Personalization
    userId: searchParams.get('userId') || undefined,
    userAgent: request.headers.get('user-agent') || undefined,
    acceptLanguage: request.headers.get('accept-language') || undefined,
    
    // A/B testing
    variant: searchParams.get('variant') || undefined,
    experimentId: searchParams.get('experiment') || undefined,
  };
}

// Edge cache utilities
export const EdgeCache = {
  // Cache TTL for different content types
  TTL: {
    STATIC_ASSETS: 86400, // 24 hours
    TRANSFORMED_IMAGES: 3600, // 1 hour
    PERSONALIZED_CONTENT: 300, // 5 minutes
    AB_TEST_CONTENT: 600, // 10 minutes
    DYNAMIC_CONTENT: 60, // 1 minute
  },
  
  // Cache headers for different scenarios
  headers: {
    static: {
      'Cache-Control': 'public, max-age=86400, immutable',
      'CDN-Cache-Control': 'public, max-age=86400',
    },
    dynamic: {
      'Cache-Control': 'public, max-age=300, stale-while-revalidate=60',
      'CDN-Cache-Control': 'public, max-age=300',
    },
    personalized: {
      'Cache-Control': 'private, max-age=300',
      'Vary': 'User-Agent, Accept-Language',
    },
  },
} as const;