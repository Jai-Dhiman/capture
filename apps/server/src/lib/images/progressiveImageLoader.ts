/**
 * Progressive Image Loader
 *
 * Client-side utility for progressive image loading with blur hash,
 * format fallbacks, and responsive images
 */

export interface ProgressiveImageOptions {
  blurHash?: string;
  sizes?: number[];
  formats?: ('webp' | 'avif' | 'jpeg')[];
  quality?: number;
  lazy?: boolean;
  fadeIn?: boolean;
  placeholder?: string;
}

export interface ResponsiveImageData {
  original: {
    width: number;
    height: number;
    url: string;
  };
  responsive: Array<{
    width: number;
    url: string;
  }>;
  blurHash?: string;
}

export class ProgressiveImageLoader {
  private imageCache = new Map<string, HTMLImageElement>();
  private supportsWebP: boolean | null = null;
  private supportsAVIF: boolean | null = null;
  private observers = new Map<HTMLImageElement, IntersectionObserver>();

  constructor() {
    this.detectFormatSupport();
  }

  /**
   * Load a progressive image with blur hash and format fallbacks
   */
  async loadProgressiveImage(
    imageId: string,
    container: HTMLElement,
    options: ProgressiveImageOptions = {},
  ): Promise<HTMLImageElement> {
    const {
      blurHash,
      sizes = [300, 600, 1200],
      formats = ['webp', 'avif', 'jpeg'],
      quality = 85,
      lazy = true,
      fadeIn = true,
    } = options;

    // Create image element
    const img = document.createElement('img');
    img.style.transition = fadeIn ? 'opacity 0.3s ease' : 'none';
    img.style.opacity = '0';
    img.classList.add('progressive-image');

    // Set up placeholder
    if (blurHash) {
      this.setBlurHashPlaceholder(container, blurHash);
    }

    // Get responsive image data
    const imageData = await this.getResponsiveImageData(imageId, sizes);

    // Determine best format
    const bestFormat = await this.getBestFormat(formats);

    // Set up srcset and sizes
    this.setupResponsiveImage(img, imageData, bestFormat, quality);

    // Handle lazy loading
    if (lazy) {
      this.setupLazyLoading(img, container);
    } else {
      this.loadImage(img, container, fadeIn);
    }

    return img;
  }

  /**
   * Create a picture element with multiple format fallbacks
   */
  async createPictureElement(
    imageId: string,
    container: HTMLElement,
    options: ProgressiveImageOptions = {},
  ): Promise<HTMLPictureElement> {
    const {
      sizes = [300, 600, 1200],
      formats = ['avif', 'webp', 'jpeg'],
      quality = 85,
      lazy = true,
    } = options;

    const picture = document.createElement('picture');
    const imageData = await this.getResponsiveImageData(imageId, sizes);

    // Create source elements for each format
    for (const format of formats) {
      if (format === 'jpeg') continue; // JPEG will be the fallback img

      const source = document.createElement('source');
      source.type = `image/${format}`;

      const srcset = imageData.responsive
        .map(
          ({ width, url }) => `${this.getImageUrl(imageId, { width, format, quality })} ${width}w`,
        )
        .join(', ');

      if (lazy) {
        source.setAttribute('data-srcset', srcset);
      } else {
        source.srcset = srcset;
      }

      source.sizes = '(max-width: 600px) 100vw, (max-width: 1200px) 50vw, 33vw';
      picture.appendChild(source);
    }

    // Create fallback img element
    const img = document.createElement('img');
    img.alt = '';
    img.style.transition = 'opacity 0.3s ease';
    img.style.opacity = '0';

    const jpegSrcset = imageData.responsive
      .map(
        ({ width, url }) =>
          `${this.getImageUrl(imageId, { width, format: 'jpeg', quality })} ${width}w`,
      )
      .join(', ');

    if (lazy) {
      img.setAttribute('data-srcset', jpegSrcset);
      img.setAttribute('data-src', imageData.original.url);
    } else {
      img.srcset = jpegSrcset;
      img.src = imageData.original.url;
    }

    img.sizes = '(max-width: 600px) 100vw, (max-width: 1200px) 50vw, 33vw';
    picture.appendChild(img);

    // Handle lazy loading
    if (lazy) {
      this.setupLazyLoading(img, container, picture);
    } else {
      this.loadImage(img, container);
    }

    return picture;
  }

  /**
   * Preload critical images
   */
  async preloadImages(imageIds: string[], sizes: number[] = [600]): Promise<void> {
    const preloadPromises = imageIds.map(async (imageId) => {
      const bestFormat = await this.getBestFormat(['webp', 'avif', 'jpeg']);
      const url = this.getImageUrl(imageId, {
        width: sizes[0],
        format: bestFormat,
        quality: 85,
      });

      if (this.imageCache.has(url)) {
        return; // Already cached
      }

      return new Promise<void>((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          this.imageCache.set(url, img);
          resolve();
        };
        img.onerror = reject;
        img.src = url;
      });
    });

    await Promise.all(preloadPromises);
  }

  /**
   * Generate blur hash placeholder
   */
  private setBlurHashPlaceholder(container: HTMLElement, blurHash: string): void {
    // This would decode the blur hash and set as background
    // For now, set a simple gradient placeholder
    container.style.background = `
      linear-gradient(45deg, 
        ${this.blurHashToColor(blurHash, 0)}, 
        ${this.blurHashToColor(blurHash, 1)}
      )
    `;
    container.style.backgroundSize = 'cover';
  }

  /**
   * Simple blur hash to color conversion (placeholder implementation)
   */
  private blurHashToColor(blurHash: string, index: number): string {
    const hash = blurHash.slice(2 + index * 2, 4 + index * 2);
    const r = parseInt(hash[0] || 'c', 36) * 7;
    const g = parseInt(hash[1] || 'c', 36) * 7;
    const b = (parseInt(hash[0] || 'c', 36) + parseInt(hash[1] || 'c', 36)) * 4;
    return `rgb(${Math.min(r, 255)}, ${Math.min(g, 255)}, ${Math.min(b, 255)})`;
  }

  /**
   * Set up responsive image attributes
   */
  private setupResponsiveImage(
    img: HTMLImageElement,
    imageData: ResponsiveImageData,
    format: string,
    quality: number,
  ): void {
    const srcset = imageData.responsive
      .map(({ width }) => {
        const url = this.getImageUrl(imageData.original.url.split('/').pop()!, {
          width,
          format: format as any,
          quality,
        });
        return `${url} ${width}w`;
      })
      .join(', ');

    img.srcset = srcset;
    img.sizes = '(max-width: 600px) 100vw, (max-width: 1200px) 50vw, 33vw';
    img.src = imageData.original.url;
  }

  /**
   * Set up lazy loading with Intersection Observer
   */
  private setupLazyLoading(
    img: HTMLImageElement,
    container: HTMLElement,
    picture?: HTMLPictureElement,
  ): void {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            this.loadLazyImage(img, picture);
            observer.unobserve(entry.target);
            this.observers.delete(img);
          }
        });
      },
      { rootMargin: '50px' },
    );

    observer.observe(container);
    this.observers.set(img, observer);
  }

  /**
   * Load lazy image
   */
  private loadLazyImage(img: HTMLImageElement, picture?: HTMLPictureElement): void {
    // Load sources in picture element
    if (picture) {
      const sources = picture.querySelectorAll('source');
      sources.forEach((source) => {
        const dataSrcset = source.getAttribute('data-srcset');
        if (dataSrcset) {
          source.srcset = dataSrcset;
          source.removeAttribute('data-srcset');
        }
      });
    }

    // Load img element
    const dataSrcset = img.getAttribute('data-srcset');
    const dataSrc = img.getAttribute('data-src');

    if (dataSrcset) {
      img.srcset = dataSrcset;
      img.removeAttribute('data-srcset');
    }

    if (dataSrc) {
      img.src = dataSrc;
      img.removeAttribute('data-src');
    }

    // Fade in when loaded
    img.onload = () => {
      img.style.opacity = '1';
    };
  }

  /**
   * Load image immediately
   */
  private loadImage(img: HTMLImageElement, container: HTMLElement, fadeIn = true): void {
    img.onload = () => {
      if (fadeIn) {
        img.style.opacity = '1';
      }
      container.appendChild(img);
    };
  }

  /**
   * Detect format support
   */
  private async detectFormatSupport(): Promise<void> {
    // Detect WebP support
    if (this.supportsWebP === null) {
      this.supportsWebP = await this.canPlayFormat('webp');
    }

    // Detect AVIF support
    if (this.supportsAVIF === null) {
      this.supportsAVIF = await this.canPlayFormat('avif');
    }
  }

  /**
   * Check if browser supports image format
   */
  private canPlayFormat(format: string): Promise<boolean> {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(true);
      img.onerror = () => resolve(false);

      const testImages = {
        webp: 'data:image/webp;base64,UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA',
        avif: 'data:image/avif;base64,AAAAIGZ0eXBhdmlmAAAAAGF2aWZtaWYxbWlhZk1BMUIAAADybWV0YQAAAAAAAAAoaGRscgAAAAAAAAAAcGljdAAAAAAAAAAAAAAAAGxpYmF2aWYAAAAADnBpdG0AAAAAAAEAAAAeaWxvYwAAAABEAAABAAEAAAABAAABGgAAAB0AAAAoaWluZgAAAAAAAQAAABppbmZlAgAAAAABAABhdjAxQ29sb3IAAAAAamlwcnAAAABLaXBjbwAAABRpc3BlAAAAAAAAAAIAAAACAAAAEHBpeGkAAAAAAwgICAAAAAxhdjFDgQ0MAAAAABNjb2xybmNseAACAAIAAYAAAAAXaXBtYQAAAAAAAAABAAEEAQKDBAAAACVtZGF0EgAKCBgABogQEAwgMg8f8D///8WfhwB8+ErK42A=',
      };

      img.src = testImages[format as keyof typeof testImages] || '';
    });
  }

  /**
   * Get best supported format
   */
  private async getBestFormat(formats: string[]): Promise<string> {
    await this.detectFormatSupport();

    for (const format of formats) {
      if (format === 'avif' && this.supportsAVIF) return 'avif';
      if (format === 'webp' && this.supportsWebP) return 'webp';
      if (format === 'jpeg') return 'jpeg';
    }

    return 'jpeg'; // Fallback
  }

  /**
   * Get responsive image data from API
   */
  private async getResponsiveImageData(
    imageId: string,
    sizes: number[],
  ): Promise<ResponsiveImageData> {
    try {
      const sizesParam = sizes.join(',');
      const response = await fetch(`/api/images/${imageId}/responsive?sizes=${sizesParam}`);
      const result = await response.json();

      if (result.success) {
        return result.data;
      }
      throw new Error(result.error || 'Failed to get image data');
    } catch (error) {
      console.error('Error getting responsive image data:', error);
      // Return fallback data
      return {
        original: {
          width: 1200,
          height: 800,
          url: `/api/images/${imageId}`,
        },
        responsive: sizes.map((width) => ({
          width,
          url: `/api/images/${imageId}?w=${width}`,
        })),
      };
    }
  }

  /**
   * Generate image URL with parameters
   */
  private getImageUrl(
    imageId: string,
    params: { width?: number; height?: number; format?: string; quality?: number } = {},
  ): string {
    const searchParams = new URLSearchParams();

    if (params.width) searchParams.set('w', params.width.toString());
    if (params.height) searchParams.set('h', params.height.toString());
    if (params.format) searchParams.set('f', params.format);
    if (params.quality) searchParams.set('q', params.quality.toString());

    const queryString = searchParams.toString();
    const separator = queryString ? '?' : '';

    return `/api/images/${imageId}${separator}${queryString}`;
  }

  /**
   * Clean up observers
   */
  dispose(): void {
    this.observers.forEach((observer) => observer.disconnect());
    this.observers.clear();
    this.imageCache.clear();
  }
}

// Export singleton instance
export const progressiveImageLoader = new ProgressiveImageLoader();
