import { createHash, createHmac } from 'crypto';
import type { ImageTransformParams } from '../wasm/wasmImageProcessor';

export interface TransformationOptions {
  width?: number;
  height?: number;
  quality?: number;
  format?: 'webp' | 'jpeg' | 'png' | 'avif';
  fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside';
  blur?: number;
  brightness?: number;
  contrast?: number;
  saturation?: number;
  rotate?: number;
  flip_horizontal?: boolean;
  flip_vertical?: boolean;
}

export interface ParsedUrlParams {
  id: string;
  transformations: TransformationOptions;
  signature?: string;
  timestamp?: number;
}

export interface UrlGenerationOptions {
  baseUrl?: string;
  signUrls?: boolean;
  urlTtl?: number; // TTL in seconds
  secretKey?: string;
}

export class ImageUrlService {
  private baseUrl: string;
  private signUrls: boolean;
  private urlTtl: number;
  private secretKey: string;

  constructor(options: UrlGenerationOptions = {}) {
    this.baseUrl = options.baseUrl || '/images';
    this.signUrls = options.signUrls || false;
    this.urlTtl = options.urlTtl || 3600; // 1 hour default
    this.secretKey = options.secretKey || 'default-secret-key';
  }

  /**
   * Generate a transformation URL for an image
   */
  generateUrl(imageId: string, transformations: TransformationOptions = {}): string {
    const params: string[] = [];

    // Add transformation parameters
    if (transformations.width) params.push(`w=${transformations.width}`);
    if (transformations.height) params.push(`h=${transformations.height}`);
    if (transformations.quality) params.push(`q=${transformations.quality}`);
    if (transformations.format) params.push(`f=${transformations.format}`);
    if (transformations.fit) params.push(`fit=${transformations.fit}`);
    if (transformations.blur) params.push(`blur=${transformations.blur}`);
    if (transformations.brightness) params.push(`brightness=${transformations.brightness}`);
    if (transformations.contrast) params.push(`contrast=${transformations.contrast}`);
    if (transformations.saturation) params.push(`saturation=${transformations.saturation}`);
    if (transformations.rotate) params.push(`rotate=${transformations.rotate}`);
    if (transformations.flip_horizontal !== undefined) {
      params.push(`flip_h=${transformations.flip_horizontal ? '1' : '0'}`);
    }
    if (transformations.flip_vertical !== undefined) {
      params.push(`flip_v=${transformations.flip_vertical ? '1' : '0'}`);
    }

    const paramString = params.join(',');
    let url = `${this.baseUrl}/${imageId}`;
    
    if (paramString) {
      url += `/${paramString}`;
    }

    // Add signature if enabled
    if (this.signUrls) {
      const timestamp = Math.floor(Date.now() / 1000);
      const signature = this.generateSignature(imageId, paramString, timestamp);
      url += `?sig=${signature}&t=${timestamp}`;
    }

    return url;
  }

  /**
   * Parse a transformation URL and extract parameters
   */
  parseUrl(url: string): ParsedUrlParams | null {
    try {
      // Check if URLPattern is available (modern browsers/runtime)
      if (typeof URLPattern !== 'undefined') {
        const pattern = new URLPattern({
          pathname: `${this.baseUrl}/:id/:params?`,
          search: '*'
        });

        const match = pattern.exec(url);
        if (!match) {
          return this.fallbackParseUrl(url);
        }

        const id = match.pathname.groups.id;
        const params = match.pathname.groups.params || '';
        
        if (!id) {
          return null;
        }

        const transformations = this.parseTransformations(params);
        
        // Extract signature and timestamp from query params
        const urlObj = new URL(url, 'http://localhost');
        const signature = urlObj.searchParams.get('sig');
        const timestamp = urlObj.searchParams.get('t');

        return {
          id,
          transformations,
          signature: signature || undefined,
          timestamp: timestamp ? parseInt(timestamp) : undefined
        };
      } else {
        // Fallback for environments without URLPattern (like Node.js tests)
        return this.fallbackParseUrl(url);
      }
    } catch (error) {
      console.error('Error parsing URL:', error);
      return this.fallbackParseUrl(url);
    }
  }

  /**
   * Fallback URL parsing using regex (for environments without URLPattern)
   */
  private fallbackParseUrl(url: string): ParsedUrlParams | null {
    // Remove base URL and query params
    const urlObj = new URL(url, 'http://localhost');
    const pathname = urlObj.pathname;
    
    // Extract path after base URL
    const basePath = this.baseUrl.replace(/^\//, '');
    const regex = new RegExp(`^/${basePath}/([^/]+)(?:/([^?]*))?`);
    const match = pathname.match(regex);
    
    if (!match) {
      return null;
    }

    const id = match[1];
    const params = match[2] || '';
    
    const transformations = this.parseTransformations(params);
    
    // Extract signature and timestamp from query params
    const signature = urlObj.searchParams.get('sig');
    const timestamp = urlObj.searchParams.get('t');

    return {
      id,
      transformations,
      signature: signature || undefined,
      timestamp: timestamp ? parseInt(timestamp) : undefined
    };
  }

  /**
   * Parse transformation parameters from URL segment
   */
  private parseTransformations(params: string): TransformationOptions {
    const transformations: TransformationOptions = {};
    
    if (!params) {
      return transformations;
    }

    const paramPairs = params.split(',');
    
    for (const pair of paramPairs) {
      const [key, value] = pair.split('=');
      if (!key || !value) continue;

      switch (key) {
        case 'w':
          transformations.width = parseInt(value);
          break;
        case 'h':
          transformations.height = parseInt(value);
          break;
        case 'q':
          transformations.quality = parseInt(value);
          break;
        case 'f':
          transformations.format = value as TransformationOptions['format'];
          break;
        case 'fit':
          transformations.fit = value as TransformationOptions['fit'];
          break;
        case 'blur':
          transformations.blur = parseFloat(value);
          break;
        case 'brightness':
          transformations.brightness = parseFloat(value);
          break;
        case 'contrast':
          transformations.contrast = parseFloat(value);
          break;
        case 'saturation':
          transformations.saturation = parseFloat(value);
          break;
        case 'rotate':
          transformations.rotate = parseFloat(value);
          break;
        case 'flip_h':
          transformations.flip_horizontal = value === '1';
          break;
        case 'flip_v':
          transformations.flip_vertical = value === '1';
          break;
      }
    }

    return transformations;
  }

  /**
   * Generate HMAC signature for URL security
   */
  private generateSignature(imageId: string, params: string, timestamp: number): string {
    const message = `${imageId}:${params}:${timestamp}`;
    return createHmac('sha256', this.secretKey)
      .update(message)
      .digest('base64url');
  }

  /**
   * Validate URL signature
   */
  validateSignature(parsedUrl: ParsedUrlParams): boolean {
    if (!this.signUrls) {
      return true; // No signature validation needed
    }

    if (!parsedUrl.signature || !parsedUrl.timestamp) {
      return false;
    }

    // Check if URL has expired
    const currentTime = Math.floor(Date.now() / 1000);
    if (currentTime - parsedUrl.timestamp > this.urlTtl) {
      return false;
    }

    // Reconstruct parameters string
    const params = this.reconstructParamsString(parsedUrl.transformations);
    
    // Generate expected signature
    const expectedSignature = this.generateSignature(
      parsedUrl.id,
      params,
      parsedUrl.timestamp
    );

    return parsedUrl.signature === expectedSignature;
  }

  /**
   * Reconstruct parameters string from transformations object
   */
  private reconstructParamsString(transformations: TransformationOptions): string {
    const params: string[] = [];

    if (transformations.width) params.push(`w=${transformations.width}`);
    if (transformations.height) params.push(`h=${transformations.height}`);
    if (transformations.quality) params.push(`q=${transformations.quality}`);
    if (transformations.format) params.push(`f=${transformations.format}`);
    if (transformations.fit) params.push(`fit=${transformations.fit}`);
    if (transformations.blur) params.push(`blur=${transformations.blur}`);
    if (transformations.brightness) params.push(`brightness=${transformations.brightness}`);
    if (transformations.contrast) params.push(`contrast=${transformations.contrast}`);
    if (transformations.saturation) params.push(`saturation=${transformations.saturation}`);
    if (transformations.rotate) params.push(`rotate=${transformations.rotate}`);
    if (transformations.flip_horizontal !== undefined) {
      params.push(`flip_h=${transformations.flip_horizontal ? '1' : '0'}`);
    }
    if (transformations.flip_vertical !== undefined) {
      params.push(`flip_v=${transformations.flip_vertical ? '1' : '0'}`);
    }

    return params.join(',');
  }

  /**
   * Convert transformation options to ImageTransformParams
   */
  transformationsToParams(transformations: TransformationOptions): ImageTransformParams {
    return {
      width: transformations.width,
      height: transformations.height,
      quality: transformations.quality,
      format: transformations.format,
      fit: transformations.fit,
      blur: transformations.blur,
      brightness: transformations.brightness,
      contrast: transformations.contrast,
      saturation: transformations.saturation,
      rotate: transformations.rotate,
      flip_horizontal: transformations.flip_horizontal,
      flip_vertical: transformations.flip_vertical
    };
  }

  /**
   * Validate transformation parameters
   */
  validateTransformations(transformations: TransformationOptions): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    // Validate width and height
    if (transformations.width !== undefined && (transformations.width < 1 || transformations.width > 4000)) {
      errors.push('Width must be between 1 and 4000 pixels');
    }
    if (transformations.height !== undefined && (transformations.height < 1 || transformations.height > 4000)) {
      errors.push('Height must be between 1 and 4000 pixels');
    }

    // Validate quality
    if (transformations.quality && (transformations.quality < 1 || transformations.quality > 100)) {
      errors.push('Quality must be between 1 and 100');
    }

    // Validate format
    const validFormats = ['webp', 'jpeg', 'png', 'avif'];
    if (transformations.format && !validFormats.includes(transformations.format)) {
      errors.push(`Format must be one of: ${validFormats.join(', ')}`);
    }

    // Validate fit
    const validFits = ['cover', 'contain', 'fill', 'inside', 'outside'];
    if (transformations.fit && !validFits.includes(transformations.fit)) {
      errors.push(`Fit must be one of: ${validFits.join(', ')}`);
    }

    // Validate blur
    if (transformations.blur && (transformations.blur < 0 || transformations.blur > 100)) {
      errors.push('Blur must be between 0 and 100');
    }

    // Validate brightness
    if (transformations.brightness && (transformations.brightness < -100 || transformations.brightness > 100)) {
      errors.push('Brightness must be between -100 and 100');
    }

    // Validate contrast
    if (transformations.contrast && (transformations.contrast < -100 || transformations.contrast > 100)) {
      errors.push('Contrast must be between -100 and 100');
    }

    // Validate saturation
    if (transformations.saturation && (transformations.saturation < -100 || transformations.saturation > 100)) {
      errors.push('Saturation must be between -100 and 100');
    }

    // Validate rotation
    if (transformations.rotate && (transformations.rotate < 0 || transformations.rotate > 360)) {
      errors.push('Rotation must be between 0 and 360 degrees');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Generate multiple preset URLs for common transformations
   */
  generatePresetUrls(imageId: string): Record<string, string> {
    const presets = {
      thumbnail: { width: 150, height: 150, quality: 80, format: 'webp' as const, fit: 'cover' as const },
      small: { width: 400, height: 400, quality: 85, format: 'webp' as const, fit: 'cover' as const },
      medium: { width: 800, height: 800, quality: 90, format: 'webp' as const, fit: 'cover' as const },
      large: { width: 1200, height: 1200, quality: 95, format: 'webp' as const, fit: 'cover' as const },
      original: {} // No transformations
    };

    const urls: Record<string, string> = {};
    
    for (const [name, transformations] of Object.entries(presets)) {
      urls[name] = this.generateUrl(imageId, transformations);
    }

    return urls;
  }

  /**
   * Get URL pattern for middleware matching
   */
  getUrlPattern(): URLPattern | null {
    if (typeof URLPattern !== 'undefined') {
      return new URLPattern({
        pathname: `${this.baseUrl}/:id/:params?`,
        search: '*'
      });
    }
    return null;
  }
}

export function createImageUrlService(options: UrlGenerationOptions = {}): ImageUrlService {
  return new ImageUrlService(options);
}