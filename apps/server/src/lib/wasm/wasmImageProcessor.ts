/**
 * WASM Image Processing Pipeline
 * 
 * This module provides a high-level interface for image transformations using
 * WASM modules with fallback to external services like Cloudflare Transform API.
 */

// Dynamic imports for WASM module to handle Cloudflare Workers properly
let wasmModule: any = null;
let wasmInitialized = false;
let wasmInitPromise: Promise<any> | null = null;
let ImageProcessor: any;

/**
 * Initialize WASM module dynamically
 */
async function initializeWasmModule(): Promise<void> {
  if (wasmInitialized) return;
  
  if (wasmInitPromise) {
    return wasmInitPromise;
  }

  wasmInitPromise = (async () => {
    try {
      console.log('Initializing WASM image processing module...');
      
      // Dynamic import for Cloudflare Workers compatibility
      wasmModule = await import('../../../wasm/capture_wasm.js');
      
      // For Cloudflare Workers, we need to initialize with the WASM binary
      try {
        const wasmBinary = await import('../../../wasm/capture_wasm_bg.wasm');
        
        // Initialize with the WASM binary
        if (wasmModule.initSync && wasmBinary.default) {
          wasmModule.initSync({ module: wasmBinary.default });
        } else if (wasmModule.default) {
          await wasmModule.default({ module: wasmBinary.default });
        }
      } catch (error) {
        console.warn('Failed to initialize with binary, trying default init:', error);
        // Fallback to default initialization
        if (wasmModule.default) {
          await wasmModule.default();
        }
      }

      // Call init_wasm if available
      if (wasmModule.init_wasm) {
        wasmModule.init_wasm();
      }

      // Assign class references
      ImageProcessor = wasmModule.ImageProcessor;

      // Verify critical classes are available
      if (!ImageProcessor) {
        throw new Error('ImageProcessor class not available after WASM initialization');
      }

      wasmInitialized = true;
      console.log('WASM image processing module initialized successfully');
    } catch (error) {
      wasmInitPromise = null;
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to initialize WASM image processing module: ${errorMessage}`);
    }
  })();

  return wasmInitPromise;
}

/**
 * Ensure WASM is initialized before use
 */
async function ensureWasmInitialized(): Promise<void> {
  if (!wasmInitialized) {
    await initializeWasmModule();
  }
  
  if (!wasmInitialized) {
    throw new Error('WASM image processing module failed to initialize');
  }
}

import { wasmMemoryOptimizer } from './wasmMemoryOptimizer.js';

// Image processing parameters interface
export interface ImageTransformParams {
  width?: number;
  height?: number;
  quality?: number;
  format?: 'jpeg' | 'png' | 'webp' | 'avif';
  fit?: 'contain' | 'cover' | 'fill' | 'inside' | 'outside';
  maintain_aspect?: boolean;
  blur?: number;
  brightness?: number;
  contrast?: number;
  saturation?: number;
  rotate?: number;
  flip_horizontal?: boolean;
  flip_vertical?: boolean;
}


// Processing result interface
export interface ImageProcessingResult {
  processedData: Uint8Array;
  format: string;
  width: number;
  height: number;
  size: number;
}

// Queue item for batch processing
interface QueueItem {
  id: string;
  imageData: Uint8Array;
  params: ImageTransformParams;
  resolve: (result: ImageProcessingResult) => void;
  reject: (error: Error) => void;
  priority: number;
}

/**
 * Simple WASM-based image processor for beta release
 */
export class WasmImageProcessor {
  private processor: any | null = null;
  private disposed = false;
  private initialized = false;
  private processingQueue: QueueItem[] = [];
  private isProcessing = false;
  private maxMemoryMB: number;

  constructor(maxMemoryMB = 512) {
    this.maxMemoryMB = maxMemoryMB;
  }

  /**
   * Initialize the WASM processor
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Ensure WASM module is initialized first
      await ensureWasmInitialized();
      
      // Now create the processor instance
      if (!ImageProcessor) {
        throw new Error('ImageProcessor class not available after WASM initialization');
      }
      
      this.processor = new ImageProcessor(this.maxMemoryMB);
      this.initialized = true;
      
      console.log(`WASM Image Processor initialized with ${this.maxMemoryMB}MB memory limit`);
    } catch (error) {
      console.error('Failed to initialize WASM processor:', error);
      throw new Error(`WASM initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Process a single image with given parameters
   */
  async processImage(
    imageData: Uint8Array,
    params: ImageTransformParams
  ): Promise<ImageProcessingResult> {
    if (!this.initialized || !this.processor || this.disposed) {
      throw new Error('Processor not initialized or disposed');
    }

    try {
      return await this.processWithWasm(imageData, params);
    } catch (error) {
      console.error('Image processing failed:', error);
      throw new Error(`Image processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Add image to processing queue for batch processing
   */
  async queueImage(
    imageData: Uint8Array,
    params: ImageTransformParams,
    priority = 0
  ): Promise<ImageProcessingResult> {
    return new Promise<ImageProcessingResult>((resolve, reject) => {
      const id = Math.random().toString(36).substring(7);
      const queueItem: QueueItem = {
        id,
        imageData,
        params,
        resolve,
        reject,
        priority,
      };

      // Insert in priority order
      const insertIndex = this.processingQueue.findIndex(item => item.priority < priority);
      if (insertIndex === -1) {
        this.processingQueue.push(queueItem);
      } else {
        this.processingQueue.splice(insertIndex, 0, queueItem);
      }

      // Start processing if not already running
      if (!this.isProcessing) {
        this.processQueue();
      }
    });
  }

  /**
   * Get information about an image without processing
   */
  async getImageInfo(imageData: Uint8Array): Promise<{
    width: number;
    height: number;
    format: string;
    size: number;
  }> {
    if (this.initialized && this.processor && !this.disposed) {
      try {
        const infoJson = this.processor.get_image_info(imageData);
        const info = JSON.parse(infoJson);
        return {
          width: info.width || 0,
          height: info.height || 0,
          format: info.format || 'unknown',
          size: imageData.length,
        };
      } catch (error) {
        console.warn('Failed to get image info from WASM, using fallback:', error);
      }
    }

    // Fallback: basic image info detection
    return this.getImageInfoFallback(imageData);
  }

  /**
   * Create multiple variants of an image (small, medium, large)
   */
  async createVariants(
    imageData: Uint8Array,
    variants: { [key: string]: ImageTransformParams }
  ): Promise<{ [key: string]: ImageProcessingResult }> {
    const results: { [key: string]: ImageProcessingResult } = {};
    
    // Process variants in parallel for better performance
    const promises = Object.entries(variants).map(async ([name, params]) => {
      const result = await this.processImage(imageData, params);
      return { name, result };
    });

    const completedVariants = await Promise.all(promises);
    
    for (const { name, result } of completedVariants) {
      results[name] = result;
    }

    return results;
  }

  /**
   * Process image using WASM
   */
  private async processWithWasm(
    imageData: Uint8Array,
    params: ImageTransformParams
  ): Promise<ImageProcessingResult> {
    if (!this.processor || this.disposed) {
      throw new Error('Processor not available');
    }

    let processedData: Uint8Array;

    // Apply transformations based on parameters
    if (params.width || params.height) {
      const format = params.format || 'webp';
      processedData = this.processor.resize(
        imageData,
        params.width || 0,
        params.height || 0,
        format
      );
    } else if (params.format) {
      processedData = this.processor.convert_format(imageData, params.format);
    } else if (params.quality) {
      const format = params.format || 'webp';
      processedData = this.processor.optimize_quality(
        imageData,
        params.quality,
        format
      );
    } else {
      // Default optimization
      processedData = this.processor.optimize_quality(imageData, 85, 'webp');
    }

    // Get processed image info
    const info = await this.getImageInfo(processedData);

    return {
      processedData,
      format: info.format,
      width: info.width,
      height: info.height,
      size: processedData.length,
    };
  }


  /**
   * Basic image info detection using WASM
   */
  private async getImageInfoFallback(imageData: Uint8Array): Promise<{
    width: number;
    height: number;
    format: string;
    size: number;
  }> {
    if (this.processor && !this.disposed) {
      try {
        const infoJson = this.processor.get_image_info(imageData);
        const info = JSON.parse(infoJson);
        return {
          width: info.width || 0,
          height: info.height || 0,
          format: info.format || 'unknown',
          size: imageData.length,
        };
      } catch (error) {
        console.warn('Failed to get image info from WASM:', error);
      }
    }

    // Fallback: basic format detection
    let format = 'unknown';
    if (imageData.length >= 8) {
      const header = imageData.slice(0, 8);
      
      if (header[0] === 0xFF && header[1] === 0xD8) {
        format = 'jpeg';
      } else if (header[0] === 0x89 && header[1] === 0x50 && header[2] === 0x4E && header[3] === 0x47) {
        format = 'png';
      } else if (header[0] === 0x52 && header[1] === 0x49 && header[2] === 0x46 && header[3] === 0x46) {
        format = 'webp';
      }
    }

    return {
      width: 0,
      height: 0,
      format,
      size: imageData.length,
    };
  }

  /**
   * Process the queue of images
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.processingQueue.length === 0) return;

    this.isProcessing = true;

    while (this.processingQueue.length > 0) {
      const item = this.processingQueue.shift();
      if (!item) continue; // Safety check instead of non-null assertion
      
      try {
        const result = await this.processImage(item.imageData, item.params);
        item.resolve(result);
      } catch (error) {
        item.reject(error instanceof Error ? error : new Error('Unknown processing error'));
      }

      // Memory cleanup between queue items
      if (this.processor) {
        const memoryUsage = this.processor.get_memory_usage();
        const threshold = this.maxMemoryMB * 1024 * 1024 * 0.8;
        
        if (memoryUsage > threshold) {
          this.processor.clear_memory();
          console.log(`Cleared WASM memory: ${memoryUsage} -> ${this.processor.get_memory_usage()} bytes`);
        }
      }
    }

    this.isProcessing = false;
  }

  /**
   * Get basic status information
   */
  getStatus(): {
    initialized: boolean;
    disposed: boolean;
    queueLength: number;
    memoryUsage?: number;
  } {
    return {
      initialized: this.initialized,
      disposed: this.disposed,
      queueLength: this.processingQueue.length,
      memoryUsage: this.processor?.get_memory_usage(),
    };
  }

  /**
   * Clear memory and reset processor state
   */
  clearMemory(): void {
    if (this.processor && !this.disposed) {
      this.processor.clear_memory();
    }
  }

  /**
   * Check if processor can handle more work
   */
  canProcessMore(): boolean {
    if (!this.initialized || !this.processor || this.disposed) return false;
    
    const memoryUsage = this.processor.get_memory_usage();
    const threshold = this.maxMemoryMB * 1024 * 1024 * 0.9; // 90% threshold
    
    return memoryUsage < threshold && this.processingQueue.length < 50;
  }

  /**
   * Dispose of WASM resources
   */
  dispose(): void {
    if (!this.disposed) {
      if (this.processor) {
        this.processor.free();
        this.processor = null;
      }
      
      // Reject any pending queue items
      for (const item of this.processingQueue) {
        item.reject(new Error('Processor disposed'));
      }
      this.processingQueue = [];
      
      this.disposed = true;
      this.initialized = false;
    }
  }

  /**
   * Check if processor is disposed
   */
  isDisposed(): boolean {
    return this.disposed;
  }
}

/**
 * Global WASM image processor instance with automatic initialization
 */
let globalProcessor: WasmImageProcessor | null = null;

/**
 * Get or create the global WASM image processor instance
 */
export async function getGlobalImageProcessor(
  maxMemoryMB = 512
): Promise<WasmImageProcessor> {
  if (!globalProcessor || globalProcessor.isDisposed()) {
    globalProcessor = new WasmImageProcessor(maxMemoryMB);
    await globalProcessor.initialize();
  }
  
  return globalProcessor;
}

/**
 * Dispose of the global processor instance
 */
export function disposeGlobalImageProcessor(): void {
  if (globalProcessor) {
    globalProcessor.dispose();
    globalProcessor = null;
  }
}

/**
 * Convenience function for processing a single image
 */
export async function processImage(
  imageData: Uint8Array,
  params: ImageTransformParams
): Promise<ImageProcessingResult> {
  const processor = await getGlobalImageProcessor(512);
  return processor.processImage(imageData, params);
}

/**
 * Convenience function for creating image variants
 */
export async function createImageVariants(
  imageData: Uint8Array,
  variants: { [key: string]: ImageTransformParams }
): Promise<{ [key: string]: ImageProcessingResult }> {
  const processor = await getGlobalImageProcessor(512);
  return processor.createVariants(imageData, variants);
}