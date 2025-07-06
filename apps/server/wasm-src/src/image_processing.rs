use std::collections::HashMap;
use std::ptr::NonNull;
use std::alloc::{alloc, dealloc, Layout};
use wasm_bindgen::prelude::*;
use wasm_bindgen_futures::future_to_promise;
use image::{ImageOutputFormat};
use image::imageops::FilterType;
use std::io::Cursor;
use js_sys::Promise;
use base64::{Engine as _, engine::general_purpose};

pub struct MemoryPool {
    pools: HashMap<usize, Vec<NonNull<u8>>>,
    allocated_blocks: HashMap<*mut u8, Layout>,
    total_allocated: usize,
    max_pool_size: usize,
}

impl MemoryPool {
    pub fn new(max_pool_size: usize) -> Self {
        Self {
            pools: HashMap::new(),
            allocated_blocks: HashMap::new(),
            total_allocated: 0,
            max_pool_size,
        }
    }

    pub fn allocate(&mut self, size: usize) -> Option<NonNull<u8>> {
        let aligned_size = (size + 7) & !7;
        
        if let Some(pool) = self.pools.get_mut(&aligned_size) {
            if let Some(ptr) = pool.pop() {
                return Some(ptr);
            }
        }

        if self.total_allocated + aligned_size > self.max_pool_size {
            return None;
        }

        let layout = Layout::from_size_align(aligned_size, 8).ok()?;
        let ptr = unsafe { alloc(layout) };
        
        if ptr.is_null() {
            return None;
        }

        let non_null = NonNull::new(ptr)?;
        self.allocated_blocks.insert(ptr, layout);
        self.total_allocated += aligned_size;
        
        Some(non_null)
    }

    pub fn deallocate(&mut self, ptr: NonNull<u8>) {
        let ptr_raw = ptr.as_ptr();
        
        if let Some(layout) = self.allocated_blocks.remove(&ptr_raw) {
            let size = layout.size();
            self.total_allocated -= size;
            
            let pool = self.pools.entry(size).or_insert_with(Vec::new);
            if pool.len() < 16 {
                pool.push(ptr);
            } else {
                unsafe { dealloc(ptr_raw, layout) };
            }
        }
    }

    pub fn clear(&mut self) {
        for (_, pool) in self.pools.iter() {
            for ptr in pool {
                if let Some(layout) = self.allocated_blocks.remove(&ptr.as_ptr()) {
                    unsafe { dealloc(ptr.as_ptr(), layout) };
                }
            }
        }
        self.pools.clear();
        self.allocated_blocks.clear();
        self.total_allocated = 0;
    }

    pub fn get_allocated_size(&self) -> usize {
        self.total_allocated
    }

    pub fn get_pool_count(&self) -> usize {
        self.pools.len()
    }
}

impl Drop for MemoryPool {
    fn drop(&mut self) {
        self.clear();
    }
}

pub struct ImageBuffer {
    data: NonNull<u8>,
    width: u32,
    height: u32,
    channels: u8,
    pool: *mut MemoryPool,
}

impl ImageBuffer {
    pub fn new(width: u32, height: u32, channels: u8, pool: &mut MemoryPool) -> Option<Self> {
        let size = (width * height * channels as u32) as usize;
        let data = pool.allocate(size)?;
        
        Some(Self {
            data,
            width,
            height,
            channels,
            pool,
        })
    }

    pub fn width(&self) -> u32 {
        self.width
    }

    pub fn height(&self) -> u32 {
        self.height
    }

    pub fn channels(&self) -> u8 {
        self.channels
    }

    pub fn data(&self) -> &[u8] {
        unsafe {
            std::slice::from_raw_parts(
                self.data.as_ptr(),
                (self.width * self.height * self.channels as u32) as usize,
            )
        }
    }

    pub fn data_mut(&mut self) -> &mut [u8] {
        unsafe {
            std::slice::from_raw_parts_mut(
                self.data.as_ptr(),
                (self.width * self.height * self.channels as u32) as usize,
            )
        }
    }

    pub fn size(&self) -> usize {
        (self.width * self.height * self.channels as u32) as usize
    }
}

impl Drop for ImageBuffer {
    fn drop(&mut self) {
        if !self.pool.is_null() {
            unsafe {
                (*self.pool).deallocate(self.data);
            }
        }
    }
}

unsafe impl Send for ImageBuffer {}
unsafe impl Sync for ImageBuffer {}

pub struct WorkItem {
    pub id: usize,
    pub operation: String,
    pub data: Vec<u8>,
    pub params: HashMap<String, String>,
}

pub struct WorkQueue {
    items: Vec<WorkItem>,
    next_id: usize,
    max_concurrent: usize,
}

impl WorkQueue {
    pub fn new(max_concurrent: usize) -> Self {
        Self {
            items: Vec::new(),
            next_id: 0,
            max_concurrent,
        }
    }

    pub fn add_work(&mut self, operation: String, data: Vec<u8>, params: HashMap<String, String>) -> usize {
        let id = self.next_id;
        self.next_id += 1;
        
        let item = WorkItem {
            id,
            operation,
            data,
            params,
        };
        
        self.items.push(item);
        id
    }

    pub fn get_work(&mut self) -> Option<WorkItem> {
        if self.items.is_empty() {
            None
        } else {
            Some(self.items.remove(0))
        }
    }

    pub fn remaining_work(&self) -> usize {
        self.items.len()
    }

    pub fn can_process(&self) -> bool {
        !self.items.is_empty()
    }
}

#[wasm_bindgen]
pub struct ImageProcessor {
    memory_pool: MemoryPool,
    work_queue: WorkQueue,
}

#[wasm_bindgen]
impl ImageProcessor {
    #[wasm_bindgen(constructor)]
    pub fn new(max_memory_mb: usize) -> Self {
        let max_pool_size = max_memory_mb * 1024 * 1024;
        Self {
            memory_pool: MemoryPool::new(max_pool_size),
            work_queue: WorkQueue::new(4), // Default to 4 concurrent operations
        }
    }

    #[wasm_bindgen]
    pub fn get_memory_usage(&self) -> usize {
        self.memory_pool.get_allocated_size()
    }

    #[wasm_bindgen]
    pub fn get_pool_count(&self) -> usize {
        self.memory_pool.get_pool_count()
    }

    #[wasm_bindgen]
    pub fn clear_memory(&mut self) {
        self.memory_pool.clear();
    }

    #[wasm_bindgen]
    pub fn create_buffer(&mut self, width: u32, height: u32, channels: u8) -> bool {
        let buffer = ImageBuffer::new(width, height, channels, &mut self.memory_pool);
        buffer.is_some()
    }

    #[wasm_bindgen]
    pub fn resize(&mut self, image_data: &[u8], width: u32, height: u32, format: &str) -> Result<Vec<u8>, String> {
        let img = image::load_from_memory(image_data)
            .map_err(|e| format!("Failed to load image: {}", e))?;
        
        let resized = img.resize(width, height, FilterType::Lanczos3);
        
        let mut output = Vec::new();
        let mut cursor = Cursor::new(&mut output);
        
        let output_format = match format.to_lowercase().as_str() {
            "jpeg" | "jpg" => ImageOutputFormat::Jpeg(85),
            "png" => ImageOutputFormat::Png,
            "webp" => ImageOutputFormat::WebP,
            _ => return Err("Unsupported format".to_string()),
        };
        
        resized.write_to(&mut cursor, output_format)
            .map_err(|e| format!("Failed to encode image: {}", e))?;
        
        Ok(output)
    }

    #[wasm_bindgen]
    pub fn convert_format(&mut self, image_data: &[u8], target_format: &str) -> Result<Vec<u8>, String> {
        let img = image::load_from_memory(image_data)
            .map_err(|e| format!("Failed to load image: {}", e))?;
        
        let mut output = Vec::new();
        let mut cursor = Cursor::new(&mut output);
        
        let output_format = match target_format.to_lowercase().as_str() {
            "jpeg" | "jpg" => ImageOutputFormat::Jpeg(85),
            "png" => ImageOutputFormat::Png,
            "webp" => ImageOutputFormat::WebP,
            _ => return Err("Unsupported format".to_string()),
        };
        
        img.write_to(&mut cursor, output_format)
            .map_err(|e| format!("Failed to encode image: {}", e))?;
        
        Ok(output)
    }

    #[wasm_bindgen]
    pub fn optimize_quality(&mut self, image_data: &[u8], quality: u8, format: &str) -> Result<Vec<u8>, String> {
        if quality > 100 {
            return Err("Quality must be between 0 and 100".to_string());
        }
        
        let img = image::load_from_memory(image_data)
            .map_err(|e| format!("Failed to load image: {}", e))?;
        
        let mut output = Vec::new();
        let mut cursor = Cursor::new(&mut output);
        
        let output_format = match format.to_lowercase().as_str() {
            "jpeg" | "jpg" => ImageOutputFormat::Jpeg(quality),
            "png" => ImageOutputFormat::Png,
            "webp" => ImageOutputFormat::WebP,
            _ => return Err("Unsupported format".to_string()),
        };
        
        img.write_to(&mut cursor, output_format)
            .map_err(|e| format!("Failed to encode image: {}", e))?;
        
        Ok(output)
    }

    #[wasm_bindgen]
    pub fn get_image_info(&self, image_data: &[u8]) -> Result<String, String> {
        let img = image::load_from_memory(image_data)
            .map_err(|e| format!("Failed to load image: {}", e))?;
        
        let info = format!(
            "{{\"width\":{},\"height\":{},\"format\":\"{}\",\"color_type\":\"{}\"}}",
            img.width(),
            img.height(),
            "unknown", // Would need to detect format from header
            format!("{:?}", img.color())
        );
        
        Ok(info)
    }

    #[wasm_bindgen]
    pub fn queue_resize(&mut self, image_data: Vec<u8>, width: u32, height: u32, format: String) -> usize {
        let mut params = HashMap::new();
        params.insert("width".to_string(), width.to_string());
        params.insert("height".to_string(), height.to_string());
        params.insert("format".to_string(), format);
        
        self.work_queue.add_work("resize".to_string(), image_data, params)
    }

    #[wasm_bindgen]
    pub fn queue_convert(&mut self, image_data: Vec<u8>, format: String) -> usize {
        let mut params = HashMap::new();
        params.insert("format".to_string(), format);
        
        self.work_queue.add_work("convert".to_string(), image_data, params)
    }

    #[wasm_bindgen]
    pub fn queue_optimize(&mut self, image_data: Vec<u8>, quality: u8, format: String) -> usize {
        let mut params = HashMap::new();
        params.insert("quality".to_string(), quality.to_string());
        params.insert("format".to_string(), format);
        
        self.work_queue.add_work("optimize".to_string(), image_data, params)
    }

    #[wasm_bindgen]
    pub fn process_work_item(&mut self) -> Result<String, String> {
        if let Some(item) = self.work_queue.get_work() {
            let result = match item.operation.as_str() {
                "resize" => {
                    let width: u32 = item.params.get("width")
                        .and_then(|s| s.parse().ok())
                        .ok_or("Invalid width parameter")?;
                    let height: u32 = item.params.get("height")
                        .and_then(|s| s.parse().ok())
                        .ok_or("Invalid height parameter")?;
                    let format = item.params.get("format")
                        .ok_or("Missing format parameter")?;
                    
                    self.resize(&item.data, width, height, format)
                        .map(|data| general_purpose::STANDARD.encode(&data))
                },
                "convert" => {
                    let format = item.params.get("format")
                        .ok_or("Missing format parameter")?;
                    
                    self.convert_format(&item.data, format)
                        .map(|data| general_purpose::STANDARD.encode(&data))
                },
                "optimize" => {
                    let quality: u8 = item.params.get("quality")
                        .and_then(|s| s.parse().ok())
                        .ok_or("Invalid quality parameter")?;
                    let format = item.params.get("format")
                        .ok_or("Missing format parameter")?;
                    
                    self.optimize_quality(&item.data, quality, format)
                        .map(|data| general_purpose::STANDARD.encode(&data))
                },
                _ => Err("Unknown operation".to_string()),
            };
            
            match result {
                Ok(data) => Ok(format!("{{\"id\":{},\"status\":\"completed\",\"data\":\"{}\"}}", item.id, data)),
                Err(e) => Ok(format!("{{\"id\":{},\"status\":\"error\",\"error\":\"{}\"}}", item.id, e)),
            }
        } else {
            Err("No work items available".to_string())
        }
    }

    #[wasm_bindgen]
    pub fn process_work_async(&mut self) -> Promise {
        let result = self.process_work_item();
        future_to_promise(async move {
            match result {
                Ok(result) => Ok(JsValue::from_str(&result)),
                Err(e) => Err(JsValue::from_str(&e)),
            }
        })
    }

    #[wasm_bindgen]
    pub fn get_queue_length(&self) -> usize {
        self.work_queue.remaining_work()
    }

    #[wasm_bindgen]
    pub fn can_process_work(&self) -> bool {
        self.work_queue.can_process()
    }

}

impl ImageProcessor {
    pub fn create_buffer_internal(&mut self, width: u32, height: u32, channels: u8) -> Option<ImageBuffer> {
        ImageBuffer::new(width, height, channels, &mut self.memory_pool)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use image::{ImageBuffer as ImageBufferLib, DynamicImage};

    #[test]
    fn test_memory_pool_basic() {
        let mut pool = MemoryPool::new(1024 * 1024);
        
        let ptr1 = pool.allocate(256).unwrap();
        let ptr2 = pool.allocate(512).unwrap();
        
        assert_eq!(pool.get_allocated_size(), 768);
        
        pool.deallocate(ptr1);
        pool.deallocate(ptr2);
        
        assert_eq!(pool.get_allocated_size(), 0);
    }

    #[test]
    fn test_image_buffer_creation() {
        let mut pool = MemoryPool::new(1024 * 1024);
        let buffer = ImageBuffer::new(100, 100, 3, &mut pool).unwrap();
        
        assert_eq!(buffer.width(), 100);
        assert_eq!(buffer.height(), 100);
        assert_eq!(buffer.channels(), 3);
        assert_eq!(buffer.size(), 30000);
    }

    #[test]
    fn test_image_processor() {
        let mut processor = ImageProcessor::new(10);
        assert_eq!(processor.get_memory_usage(), 0);
        
        let _buffer = processor.create_buffer_internal(50, 50, 4).unwrap();
        assert!(processor.get_memory_usage() > 0);
        
        processor.clear_memory();
        assert_eq!(processor.get_memory_usage(), 0);
    }

    #[test]
    fn test_resize_function() {
        let mut processor = ImageProcessor::new(10);
        
        // Create a simple 2x2 RGB image
        let img = ImageBufferLib::from_fn(2, 2, |_x, _y| {
            image::Rgb([255u8, 0u8, 0u8]) // Red pixels
        });
        
        let mut image_data = Vec::new();
        let mut cursor = Cursor::new(&mut image_data);
        DynamicImage::ImageRgb8(img).write_to(&mut cursor, ImageOutputFormat::Png).unwrap();
        
        let result = processor.resize(&image_data, 4, 4, "png");
        assert!(result.is_ok());
        
        let resized_data = result.unwrap();
        assert!(!resized_data.is_empty());
    }

    #[test]
    fn test_convert_format() {
        let mut processor = ImageProcessor::new(10);
        
        // Create a simple 2x2 RGB image
        let img = ImageBufferLib::from_fn(2, 2, |_x, _y| {
            image::Rgb([255u8, 0u8, 0u8]) // Red pixels
        });
        
        let mut image_data = Vec::new();
        let mut cursor = Cursor::new(&mut image_data);
        DynamicImage::ImageRgb8(img).write_to(&mut cursor, ImageOutputFormat::Png).unwrap();
        
        let result = processor.convert_format(&image_data, "jpeg");
        assert!(result.is_ok());
        
        let converted_data = result.unwrap();
        assert!(!converted_data.is_empty());
    }

    #[test]
    fn test_optimize_quality() {
        let mut processor = ImageProcessor::new(10);
        
        // Create a simple 2x2 RGB image
        let img = ImageBufferLib::from_fn(2, 2, |_x, _y| {
            image::Rgb([255u8, 0u8, 0u8]) // Red pixels
        });
        
        let mut image_data = Vec::new();
        let mut cursor = Cursor::new(&mut image_data);
        DynamicImage::ImageRgb8(img).write_to(&mut cursor, ImageOutputFormat::Png).unwrap();
        
        let result = processor.optimize_quality(&image_data, 50, "jpeg");
        assert!(result.is_ok());
        
        let optimized_data = result.unwrap();
        assert!(!optimized_data.is_empty());
    }

    #[test]
    fn test_get_image_info() {
        let processor = ImageProcessor::new(10);
        
        // Create a simple 2x2 RGB image
        let img = ImageBufferLib::from_fn(2, 2, |_x, _y| {
            image::Rgb([255u8, 0u8, 0u8]) // Red pixels
        });
        
        let mut image_data = Vec::new();
        let mut cursor = Cursor::new(&mut image_data);
        DynamicImage::ImageRgb8(img).write_to(&mut cursor, ImageOutputFormat::Png).unwrap();
        
        let result = processor.get_image_info(&image_data);
        assert!(result.is_ok());
        
        let info = result.unwrap();
        assert!(info.contains("width"));
        assert!(info.contains("height"));
    }
}