//! Test suite for the Web and headless browsers.

#![cfg(target_arch = "wasm32")]

extern crate wasm_bindgen_test;
use wasm_bindgen_test::*;
use capture_wasm::*;
use js_sys::Float32Array;

wasm_bindgen_test_configure!(run_in_browser);

// Basic function tests
#[wasm_bindgen_test]
fn test_add_function() {
    assert_eq!(add(5, 3), 8);
    assert_eq!(add(-1, 1), 0);
    assert_eq!(add(0, 0), 0);
}

#[wasm_bindgen_test]
fn test_fibonacci_function() {
    assert_eq!(fibonacci(0), 0);
    assert_eq!(fibonacci(1), 1);
    assert_eq!(fibonacci(5), 5);
    assert_eq!(fibonacci(10), 55);
}

#[wasm_bindgen_test]
fn test_process_array_function() {
    let input = vec![1, 2, 3, 4, 5];
    let result = process_array(&input);
    let expected = vec![2, 4, 6, 8, 10];
    assert_eq!(result, expected);
}

#[wasm_bindgen_test]
fn test_init_wasm() {
    init_wasm();
}

// Vector768 tests
#[wasm_bindgen_test]
fn test_vector768_creation() {
    let data: Vec<f32> = (0..768).map(|i| i as f32).collect();
    let vector = Vector768::new(&data);
    assert!(vector.is_ok());
}

#[wasm_bindgen_test]
fn test_vector768_invalid_size() {
    let data: Vec<f32> = (0..100).map(|i| i as f32).collect();
    let vector = Vector768::new(&data);
    assert!(vector.is_err());
}

#[wasm_bindgen_test]
fn test_vector768_dot_product() {
    let data1: Vec<f32> = vec![1.0; 768];
    let data2: Vec<f32> = vec![2.0; 768];
    
    let vector1 = Vector768::new(&data1).unwrap();
    let vector2 = Vector768::new(&data2).unwrap();
    
    let dot_product = vector1.dot_product(&vector2);
    assert_eq!(dot_product, 768.0 * 2.0);
}

#[wasm_bindgen_test]
fn test_vector768_magnitude() {
    let data: Vec<f32> = vec![1.0; 768];
    let vector = Vector768::new(&data).unwrap();
    
    let magnitude = vector.magnitude();
    let expected = (768.0_f32).sqrt();
    assert!((magnitude - expected).abs() < 1e-6);
}

#[wasm_bindgen_test]
fn test_vector768_cosine_similarity() {
    let data1: Vec<f32> = vec![1.0; 768];
    let data2: Vec<f32> = vec![1.0; 768];
    
    let vector1 = Vector768::new(&data1).unwrap();
    let vector2 = Vector768::new(&data2).unwrap();
    
    let similarity = vector1.cosine_similarity(&vector2);
    assert!((similarity - 1.0).abs() < 1e-6);
}

#[wasm_bindgen_test]
fn test_vector768_normalize() {
    let data: Vec<f32> = vec![2.0; 768];
    let vector = Vector768::new(&data).unwrap();
    let normalized = vector.normalize();
    
    let magnitude = normalized.magnitude();
    assert!((magnitude - 1.0).abs() < 1e-6);
}

#[wasm_bindgen_test]
fn test_vector768_operations() {
    let data1: Vec<f32> = vec![1.0; 768];
    let data2: Vec<f32> = vec![2.0; 768];
    
    let vector1 = Vector768::new(&data1).unwrap();
    let vector2 = Vector768::new(&data2).unwrap();
    
    let sum = vector1.add(&vector2);
    let diff = vector2.subtract(&vector1);
    let scaled = vector1.scale(3.0);
    
    // Test that operations produce valid vectors
    assert_eq!(sum.magnitude(), (768.0 * 9.0_f32).sqrt());
    assert_eq!(diff.magnitude(), (768.0_f32).sqrt());
    assert_eq!(scaled.magnitude(), 3.0 * (768.0_f32).sqrt());
}

// DiscoveryScorer tests
#[wasm_bindgen_test]
fn test_discovery_scorer() {
    let user_data: Vec<f32> = vec![1.0; 768];
    let user_vector = Vector768::new(&user_data).unwrap();
    let scorer = DiscoveryScorer::new(&user_vector);
    
    let content_data: Vec<f32> = vec![0.5; 768];
    let content_vector = Vector768::new(&content_data).unwrap();
    
    let score = scorer.score_content(&content_vector, 0.8, 0.6);
    assert!(score >= 0.0 && score <= 1.0);
}

#[wasm_bindgen_test]
fn test_discovery_scorer_update_weights() {
    let user_data: Vec<f32> = vec![1.0; 768];
    let user_vector = Vector768::new(&user_data).unwrap();
    let mut scorer = DiscoveryScorer::new(&user_vector);
    
    scorer.update_weights(0.5, 0.3, 0.1, 0.1);
    
    let content_data: Vec<f32> = vec![1.0; 768];
    let content_vector = Vector768::new(&content_data).unwrap();
    let score = scorer.score_content(&content_vector, 0.8, 0.6);
    
    assert!(score >= 0.0 && score <= 1.0);
}

// BatchProcessor tests
#[wasm_bindgen_test]
fn test_batch_processor() {
    let processor = BatchProcessor::new(100);
    
    let query_data: Vec<f32> = vec![1.0; 768];
    let query_vector = Vector768::new(&query_data).unwrap();
    
    // Create batch data (3 vectors)
    let mut batch_data = Vec::with_capacity(768 * 3);
    for _ in 0..3 {
        batch_data.extend(vec![0.5; 768]);
    }
    let batch_array = Float32Array::from(&batch_data[..]);
    
    let similarities = processor.process_similarity_batch(&query_vector, &batch_array);
    assert_eq!(similarities.length(), 3);
}

#[wasm_bindgen_test]
fn test_batch_processor_top_k() {
    let processor = BatchProcessor::new(100);
    
    let query_data: Vec<f32> = vec![1.0; 768];
    let query_vector = Vector768::new(&query_data).unwrap();
    
    // Create batch data (5 vectors)
    let mut batch_data = Vec::with_capacity(768 * 5);
    for i in 0..5 {
        let val = (i as f32 + 1.0) * 0.2;
        batch_data.extend(vec![val; 768]);
    }
    let batch_array = Float32Array::from(&batch_data[..]);
    
    let top_similarities = processor.find_top_k_similar(&query_vector, &batch_array, 3);
    assert_eq!(top_similarities.length(), 3);
}

#[wasm_bindgen_test]
fn test_batch_processor_centroid() {
    let processor = BatchProcessor::new(100);
    
    // Create batch data (2 vectors)
    let mut batch_data = Vec::with_capacity(768 * 2);
    batch_data.extend(vec![1.0; 768]);
    batch_data.extend(vec![3.0; 768]);
    let batch_array = Float32Array::from(&batch_data[..]);
    
    let centroid = processor.compute_centroid(&batch_array);
    assert!(centroid.is_ok());
    
    // Centroid should be [2.0; 768]
    let centroid_vector = centroid.unwrap();
    let expected_magnitude = 2.0 * (768.0_f32).sqrt();
    assert!((centroid_vector.magnitude() - expected_magnitude).abs() < 1e-5);
}

// High-level function tests
#[wasm_bindgen_test]
fn test_compute_batch_similarities() {
    let query_data: Vec<f32> = vec![1.0; 768];
    
    let mut vectors_data = Vec::with_capacity(768 * 2);
    vectors_data.extend(vec![0.5; 768]);
    vectors_data.extend(vec![1.0; 768]);
    let vectors_array = Float32Array::from(&vectors_data[..]);
    
    let similarities = compute_batch_similarities(&query_data, &vectors_array);
    assert!(similarities.is_ok());
    
    let result = similarities.unwrap();
    assert_eq!(result.length(), 2);
}

#[wasm_bindgen_test]
fn test_find_most_similar_vectors() {
    let query_data: Vec<f32> = vec![1.0; 768];
    
    let mut vectors_data = Vec::with_capacity(768 * 3);
    for i in 0..3 {
        let val = (i as f32 + 1.0) * 0.3;
        vectors_data.extend(vec![val; 768]);
    }
    let vectors_array = Float32Array::from(&vectors_data[..]);
    
    let top_similar = find_most_similar_vectors(&query_data, &vectors_array, 2);
    assert!(top_similar.is_ok());
    
    let result = top_similar.unwrap();
    assert_eq!(result.length(), 2);
}

#[wasm_bindgen_test]
fn test_score_content_batch() {
    let user_prefs: Vec<f32> = vec![1.0; 768];
    
    let mut content_vectors = Vec::with_capacity(768 * 2);
    content_vectors.extend(vec![0.8; 768]);
    content_vectors.extend(vec![0.6; 768]);
    let content_array = Float32Array::from(&content_vectors[..]);
    
    let recency_scores = vec![0.9, 0.7];
    let popularity_scores = vec![0.8, 0.6];
    
    let scores = score_content_batch(&user_prefs, &content_array, &recency_scores, &popularity_scores);
    assert!(scores.is_ok());
    
    let result = scores.unwrap();
    assert_eq!(result.length(), 2);
}
