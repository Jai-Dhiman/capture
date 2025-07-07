import { describe, it, expect, beforeEach } from 'vitest';
import { ImageUrlService, createImageUrlService } from '../lib/images/urlService';
import type { TransformationOptions } from '../lib/images/urlService';

describe('ImageUrlService', () => {
  let urlService: ImageUrlService;
  let signedUrlService: ImageUrlService;

  beforeEach(() => {
    urlService = createImageUrlService({
      baseUrl: '/images',
      signUrls: false
    });

    signedUrlService = createImageUrlService({
      baseUrl: '/images',
      signUrls: true,
      urlTtl: 3600,
      secretKey: 'test-secret-key'
    });
  });

  describe('URL Generation', () => {
    it('should generate basic URL without transformations', () => {
      const url = urlService.generateUrl('test-image-id');
      expect(url).toBe('/images/test-image-id');
    });

    it('should generate URL with width and height', () => {
      const url = urlService.generateUrl('test-image-id', { width: 300, height: 200 });
      expect(url).toBe('/images/test-image-id/w=300,h=200');
    });

    it('should generate URL with quality and format', () => {
      const url = urlService.generateUrl('test-image-id', { quality: 85, format: 'webp' });
      expect(url).toBe('/images/test-image-id/q=85,f=webp');
    });

    it('should generate URL with all transformation parameters', () => {
      const transformations: TransformationOptions = {
        width: 800,
        height: 600,
        quality: 90,
        format: 'webp',
        fit: 'cover',
        blur: 2,
        brightness: 10,
        contrast: 5,
        saturation: -5,
        rotate: 90,
        flip_horizontal: true,
        flip_vertical: false
      };

      const url = urlService.generateUrl('test-image-id', transformations);
      expect(url).toBe('/images/test-image-id/w=800,h=600,q=90,f=webp,fit=cover,blur=2,brightness=10,contrast=5,saturation=-5,rotate=90,flip_h=1,flip_v=0');
    });

    it('should generate signed URL with timestamp and signature', () => {
      const url = signedUrlService.generateUrl('test-image-id', { width: 300, height: 200 });
      expect(url).toMatch(/^\/images\/test-image-id\/w=300,h=200\?sig=[\w-]+&t=\d+$/);
    });
  });

  describe('URL Parsing', () => {
    it('should parse basic URL without transformations', () => {
      const parsed = urlService.parseUrl('/images/test-image-id');
      expect(parsed).toEqual({
        id: 'test-image-id',
        transformations: {},
        signature: undefined,
        timestamp: undefined
      });
    });

    it('should parse URL with width and height', () => {
      const parsed = urlService.parseUrl('/images/test-image-id/w=300,h=200');
      expect(parsed).toEqual({
        id: 'test-image-id',
        transformations: { width: 300, height: 200 },
        signature: undefined,
        timestamp: undefined
      });
    });

    it('should parse URL with quality and format', () => {
      const parsed = urlService.parseUrl('/images/test-image-id/q=85,f=webp');
      expect(parsed).toEqual({
        id: 'test-image-id',
        transformations: { quality: 85, format: 'webp' },
        signature: undefined,
        timestamp: undefined
      });
    });

    it('should parse URL with all transformation parameters', () => {
      const url = '/images/test-image-id/w=800,h=600,q=90,f=webp,fit=cover,blur=2,brightness=10,contrast=5,saturation=-5,rotate=90,flip_h=1,flip_v=0';
      const parsed = urlService.parseUrl(url);
      
      expect(parsed).toEqual({
        id: 'test-image-id',
        transformations: {
          width: 800,
          height: 600,
          quality: 90,
          format: 'webp',
          fit: 'cover',
          blur: 2,
          brightness: 10,
          contrast: 5,
          saturation: -5,
          rotate: 90,
          flip_horizontal: true,
          flip_vertical: false
        },
        signature: undefined,
        timestamp: undefined
      });
    });

    it('should parse signed URL with signature and timestamp', () => {
      const url = '/images/test-image-id/w=300,h=200?sig=abc123&t=1234567890';
      const parsed = urlService.parseUrl(url);
      
      expect(parsed).toEqual({
        id: 'test-image-id',
        transformations: { width: 300, height: 200 },
        signature: 'abc123',
        timestamp: 1234567890
      });
    });

    it('should return null for invalid URLs', () => {
      const parsed = urlService.parseUrl('/invalid/url');
      expect(parsed).toBeNull();
    });

    it('should handle URLs with missing parameters gracefully', () => {
      const parsed = urlService.parseUrl('/images/test-image-id/w=,h=200,q=');
      expect(parsed).toEqual({
        id: 'test-image-id',
        transformations: { height: 200 },
        signature: undefined,
        timestamp: undefined
      });
    });
  });

  describe('URL Validation', () => {
    it('should validate transformations successfully', () => {
      const transformations: TransformationOptions = {
        width: 800,
        height: 600,
        quality: 90,
        format: 'webp',
        fit: 'cover',
        blur: 2,
        brightness: 10,
        contrast: 5,
        saturation: -5,
        rotate: 90
      };

      const validation = urlService.validateTransformations(transformations);
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should reject invalid width and height', () => {
      const transformations: TransformationOptions = {
        width: 5000,
        height: 0
      };

      const validation = urlService.validateTransformations(transformations);
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Width must be between 1 and 4000 pixels');
      expect(validation.errors).toContain('Height must be between 1 and 4000 pixels');
    });

    it('should reject invalid quality', () => {
      const transformations: TransformationOptions = {
        quality: 150
      };

      const validation = urlService.validateTransformations(transformations);
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Quality must be between 1 and 100');
    });

    it('should reject invalid format', () => {
      const transformations: TransformationOptions = {
        format: 'gif' as any
      };

      const validation = urlService.validateTransformations(transformations);
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Format must be one of: webp, jpeg, png, avif');
    });

    it('should reject invalid fit', () => {
      const transformations: TransformationOptions = {
        fit: 'invalid' as any
      };

      const validation = urlService.validateTransformations(transformations);
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Fit must be one of: cover, contain, fill, inside, outside');
    });

    it('should reject out-of-range blur, brightness, contrast, saturation', () => {
      const transformations: TransformationOptions = {
        blur: 150,
        brightness: 150,
        contrast: -150,
        saturation: 150
      };

      const validation = urlService.validateTransformations(transformations);
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Blur must be between 0 and 100');
      expect(validation.errors).toContain('Brightness must be between -100 and 100');
      expect(validation.errors).toContain('Contrast must be between -100 and 100');
      expect(validation.errors).toContain('Saturation must be between -100 and 100');
    });

    it('should reject invalid rotation', () => {
      const transformations: TransformationOptions = {
        rotate: 450
      };

      const validation = urlService.validateTransformations(transformations);
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Rotation must be between 0 and 360 degrees');
    });
  });

  describe('URL Signing', () => {
    it('should validate correct signature', () => {
      const url = signedUrlService.generateUrl('test-image-id', { width: 300, height: 200 });
      const parsed = signedUrlService.parseUrl(url);
      
      expect(parsed).not.toBeNull();
      const isValid = signedUrlService.validateSignature(parsed!);
      expect(isValid).toBe(true);
    });

    it('should reject invalid signature', () => {
      const parsed = {
        id: 'test-image-id',
        transformations: { width: 300, height: 200 },
        signature: 'invalid-signature',
        timestamp: Math.floor(Date.now() / 1000)
      };

      const isValid = signedUrlService.validateSignature(parsed);
      expect(isValid).toBe(false);
    });

    it('should reject expired URLs', () => {
      const expiredTimestamp = Math.floor(Date.now() / 1000) - 7200; // 2 hours ago
      const parsed = {
        id: 'test-image-id',
        transformations: { width: 300, height: 200 },
        signature: 'some-signature',
        timestamp: expiredTimestamp
      };

      const isValid = signedUrlService.validateSignature(parsed);
      expect(isValid).toBe(false);
    });

    it('should reject URLs without signature when signing is enabled', () => {
      const parsed = {
        id: 'test-image-id',
        transformations: { width: 300, height: 200 },
        signature: undefined,
        timestamp: undefined
      };

      const isValid = signedUrlService.validateSignature(parsed);
      expect(isValid).toBe(false);
    });
  });

  describe('Preset URLs', () => {
    it('should generate preset URLs correctly', () => {
      const presets = urlService.generatePresetUrls('test-image-id');
      
      expect(presets.thumbnail).toBe('/images/test-image-id/w=150,h=150,q=80,f=webp,fit=cover');
      expect(presets.small).toBe('/images/test-image-id/w=400,h=400,q=85,f=webp,fit=cover');
      expect(presets.medium).toBe('/images/test-image-id/w=800,h=800,q=90,f=webp,fit=cover');
      expect(presets.large).toBe('/images/test-image-id/w=1200,h=1200,q=95,f=webp,fit=cover');
      expect(presets.original).toBe('/images/test-image-id');
    });
  });

  describe('Round-trip tests', () => {
    it('should maintain consistency between generation and parsing', () => {
      const originalTransformations: TransformationOptions = {
        width: 800,
        height: 600,
        quality: 90,
        format: 'webp',
        fit: 'cover',
        blur: 2,
        brightness: 10,
        contrast: 5,
        saturation: -5,
        rotate: 90,
        flip_horizontal: true,
        flip_vertical: false
      };

      const url = urlService.generateUrl('test-image-id', originalTransformations);
      const parsed = urlService.parseUrl(url);

      expect(parsed).not.toBeNull();
      expect(parsed!.id).toBe('test-image-id');
      expect(parsed!.transformations).toEqual(originalTransformations);
    });

    it('should maintain consistency for signed URLs', () => {
      const originalTransformations: TransformationOptions = {
        width: 300,
        height: 200,
        quality: 85,
        format: 'webp'
      };

      const url = signedUrlService.generateUrl('test-image-id', originalTransformations);
      const parsed = signedUrlService.parseUrl(url);

      expect(parsed).not.toBeNull();
      expect(parsed!.id).toBe('test-image-id');
      expect(parsed!.transformations).toEqual(originalTransformations);
      expect(parsed!.signature).toBeDefined();
      expect(parsed!.timestamp).toBeDefined();
      
      const isValid = signedUrlService.validateSignature(parsed!);
      expect(isValid).toBe(true);
    });
  });

  describe('Edge cases', () => {
    it('should handle empty transformations', () => {
      const url = urlService.generateUrl('test-image-id', {});
      expect(url).toBe('/images/test-image-id');
      
      const parsed = urlService.parseUrl(url);
      expect(parsed).toEqual({
        id: 'test-image-id',
        transformations: {},
        signature: undefined,
        timestamp: undefined
      });
    });

    it('should handle special characters in image ID', () => {
      const specialId = 'test-image_123.jpg';
      const url = urlService.generateUrl(specialId, { width: 300 });
      expect(url).toBe('/images/test-image_123.jpg/w=300');
      
      const parsed = urlService.parseUrl(url);
      expect(parsed!.id).toBe(specialId);
    });

    it('should handle boolean flip parameters correctly', () => {
      const transformations: TransformationOptions = {
        flip_horizontal: true,
        flip_vertical: false
      };

      const url = urlService.generateUrl('test-image-id', transformations);
      expect(url).toBe('/images/test-image-id/flip_h=1,flip_v=0');
      
      const parsed = urlService.parseUrl(url);
      expect(parsed!.transformations.flip_horizontal).toBe(true);
      expect(parsed!.transformations.flip_vertical).toBe(false);
    });

    it('should handle decimal values correctly', () => {
      const transformations: TransformationOptions = {
        blur: 2.5,
        brightness: 10.5,
        contrast: -5.2,
        saturation: 8.7,
        rotate: 45.5
      };

      const url = urlService.generateUrl('test-image-id', transformations);
      const parsed = urlService.parseUrl(url);
      
      expect(parsed!.transformations.blur).toBe(2.5);
      expect(parsed!.transformations.brightness).toBe(10.5);
      expect(parsed!.transformations.contrast).toBe(-5.2);
      expect(parsed!.transformations.saturation).toBe(8.7);
      expect(parsed!.transformations.rotate).toBe(45.5);
    });
  });
});