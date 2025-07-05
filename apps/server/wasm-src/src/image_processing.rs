use base64::{engine::general_purpose, Engine as _};
use image::{codecs::jpeg::JpegEncoder, DynamicImage, ImageFormat};
use std::io::Cursor;
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub struct ImageProcessor {
    image: Option<DynamicImage>,
}

#[wasm_bindgen]
pub struct ProcessingOptions {
    pub quality: u8,
    pub progressive: bool,
    pub strip_metadata: bool,
    pub max_width: u32,
    pub max_height: u32,
}

#[wasm_bindgen]
impl ProcessingOptions {
    #[wasm_bindgen(constructor)]
    pub fn new() -> ProcessingOptions {
        ProcessingOptions {
            quality: 85,
            progressive: true,
            strip_metadata: true,
            max_width: 2048,
            max_height: 2048,
        }
    }
}

#[wasm_bindgen]
impl ImageProcessor {
    #[wasm_bindgen(constructor)]
    pub fn new() -> ImageProcessor {
        ImageProcessor { image: None }
    }

    #[wasm_bindgen]
    pub fn load_from_bytes(&mut self, data: &[u8]) -> Result<(), JsValue> {
        match image::load_from_memory(data) {
            Ok(img) => {
                self.image = Some(img);
                Ok(())
            }
            Err(e) => Err(JsValue::from_str(&format!("Failed to load image: {}", e))),
        }
    }

    #[wasm_bindgen]
    pub fn load_from_base64(&mut self, base64_data: &str) -> Result<(), JsValue> {
        let data = general_purpose::STANDARD
            .decode(base64_data)
            .map_err(|e| JsValue::from_str(&format!("Invalid base64: {}", e)))?;
        self.load_from_bytes(&data)
    }

    #[wasm_bindgen]
    pub fn get_dimensions(&self) -> Vec<u32> {
        if let Some(img) = &self.image {
            vec![img.width(), img.height()]
        } else {
            vec![0, 0]
        }
    }

    #[wasm_bindgen]
    pub fn resize(
        &mut self,
        width: u32,
        height: u32,
        maintain_aspect: bool,
    ) -> Result<(), JsValue> {
        if let Some(img) = &mut self.image {
            let (new_width, new_height) = if maintain_aspect {
                let aspect_ratio = img.width() as f32 / img.height() as f32;
                if width as f32 / height as f32 > aspect_ratio {
                    ((height as f32 * aspect_ratio) as u32, height)
                } else {
                    (width, (width as f32 / aspect_ratio) as u32)
                }
            } else {
                (width, height)
            };

            *img = img.resize(new_width, new_height, image::imageops::FilterType::Lanczos3);
            Ok(())
        } else {
            Err(JsValue::from_str("No image loaded"))
        }
    }

    #[wasm_bindgen]
    pub fn create_thumbnail(&mut self, size: u32) -> Result<String, JsValue> {
        if let Some(img) = &self.image {
            let thumb = img.thumbnail(size, size);
            let mut buffer = Vec::new();
            let mut cursor = Cursor::new(&mut buffer);

            thumb
                .write_to(&mut cursor, ImageFormat::Jpeg)
                .map_err(|e| JsValue::from_str(&format!("Failed to encode thumbnail: {}", e)))?;

            Ok(general_purpose::STANDARD.encode(&buffer))
        } else {
            Err(JsValue::from_str("No image loaded"))
        }
    }

    #[wasm_bindgen]
    pub fn compress_to_webp(&self, _quality: u8) -> Result<String, JsValue> {
        if let Some(img) = &self.image {
            let mut buffer = Vec::new();
            let mut cursor = Cursor::new(&mut buffer);

            img.write_to(&mut cursor, ImageFormat::WebP)
                .map_err(|e| JsValue::from_str(&format!("Failed to encode WebP: {}", e)))?;

            Ok(general_purpose::STANDARD.encode(&buffer))
        } else {
            Err(JsValue::from_str("No image loaded"))
        }
    }

    #[wasm_bindgen]
    pub fn compress_to_jpeg(&self, options: &ProcessingOptions) -> Result<String, JsValue> {
        if let Some(img) = &self.image {
            let mut buffer = Vec::new();
            let mut cursor = Cursor::new(&mut buffer);

            if options.progressive {
                let mut encoder = JpegEncoder::new_with_quality(&mut cursor, options.quality);
                encoder
                    .encode_image(img)
                    .map_err(|e| JsValue::from_str(&format!("Failed to encode JPEG: {}", e)))?;
            } else {
                img.write_to(&mut cursor, ImageFormat::Jpeg)
                    .map_err(|e| JsValue::from_str(&format!("Failed to encode JPEG: {}", e)))?;
            }

            Ok(general_purpose::STANDARD.encode(&buffer))
        } else {
            Err(JsValue::from_str("No image loaded"))
        }
    }

    #[wasm_bindgen]
    pub fn auto_orient(&mut self) -> Result<(), JsValue> {
        if let Some(_img) = &mut self.image {
            // Basic auto-orientation - in real implementation would read EXIF
            // For now, just ensure image is properly oriented
            Ok(())
        } else {
            Err(JsValue::from_str("No image loaded"))
        }
    }

    #[wasm_bindgen]
    pub fn crop_smart(&mut self, target_width: u32, target_height: u32) -> Result<(), JsValue> {
        if let Some(img) = &mut self.image {
            let (img_width, img_height) = (img.width(), img.height());

            // Simple center crop for now - in real implementation would use smartcrop-rs
            let crop_width = target_width.min(img_width);
            let crop_height = target_height.min(img_height);
            let x = (img_width - crop_width) / 2;
            let y = (img_height - crop_height) / 2;

            *img = img.crop_imm(x, y, crop_width, crop_height);
            Ok(())
        } else {
            Err(JsValue::from_str("No image loaded"))
        }
    }

    #[wasm_bindgen]
    pub fn extract_metadata(&self) -> Result<String, JsValue> {
        // In real implementation would use kamadak-exif to extract EXIF data
        // For now return basic metadata
        if let Some(img) = &self.image {
            let metadata = format!(
                r#"{{"width": {}, "height": {}, "format": "unknown"}}"#,
                img.width(),
                img.height()
            );
            Ok(metadata)
        } else {
            Err(JsValue::from_str("No image loaded"))
        }
    }

    #[wasm_bindgen]
    pub fn strip_metadata(&mut self) -> Result<(), JsValue> {
        // Metadata is automatically stripped when we re-encode the image
        Ok(())
    }
}

// Batch processing functions
#[wasm_bindgen]
pub fn batch_resize_images(
    images_base64: Vec<String>,
    width: u32,
    height: u32,
) -> Result<Vec<String>, JsValue> {
    let mut results = Vec::new();

    for img_data in images_base64 {
        let mut processor = ImageProcessor::new();
        processor.load_from_base64(&img_data)?;
        processor.resize(width, height, true)?;

        let options = ProcessingOptions::new();
        let result = processor.compress_to_jpeg(&options)?;
        results.push(result);
    }

    Ok(results)
}

#[wasm_bindgen]
pub fn create_responsive_images(
    base64_data: &str,
    sizes: Vec<u32>,
) -> Result<Vec<String>, JsValue> {
    let mut results = Vec::new();

    for size in sizes {
        let mut processor = ImageProcessor::new();
        processor.load_from_base64(base64_data)?;
        let thumbnail = processor.create_thumbnail(size)?;
        results.push(thumbnail);
    }

    Ok(results)
}

#[wasm_bindgen]
pub fn optimize_for_web(base64_data: &str, max_size: u32, quality: u8) -> Result<String, JsValue> {
    let mut processor = ImageProcessor::new();
    processor.load_from_base64(base64_data)?;

    let dims = processor.get_dimensions();
    if dims[0] > max_size || dims[1] > max_size {
        processor.resize(max_size, max_size, true)?;
    }

    let mut options = ProcessingOptions::new();
    options.quality = quality;
    options.progressive = true;
    options.strip_metadata = true;

    processor.compress_to_jpeg(&options)
}
