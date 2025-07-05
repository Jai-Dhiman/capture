mod utils;
pub mod vector_math;
pub mod image_processing;
pub mod crypto;

use wasm_bindgen::prelude::*;

// Re-export types for easier access
pub use vector_math::{Vector1024, DiscoveryScorer, BatchProcessor};
pub use image_processing::{ImageProcessor, ProcessingOptions};
pub use crypto::{CryptoProcessor, JwtPayload};

#[wasm_bindgen]
extern "C" {
    fn alert(s: &str);
    
    #[wasm_bindgen(js_namespace = console)]
    fn log(s: &str);
}

#[wasm_bindgen]
pub fn greet() {
    alert("Hello, capture-wasm!");
}

#[wasm_bindgen]
pub fn add(a: i32, b: i32) -> i32 {
    a + b
}

#[wasm_bindgen]
pub fn fibonacci(n: i32) -> i32 {
    if n <= 1 {
        n
    } else {
        fibonacci(n - 1) + fibonacci(n - 2)
    }
}

#[wasm_bindgen]
pub fn process_array(numbers: &[i32]) -> Vec<i32> {
    numbers.iter().map(|x| x * 2).collect()
}

#[wasm_bindgen]
pub fn init_wasm() {
    utils::set_panic_hook();
    log("WASM module initialized with vector mathematics support!");
}
