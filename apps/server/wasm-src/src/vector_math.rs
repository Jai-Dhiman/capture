use js_sys::Float32Array;
use nalgebra::DVector;
use std::collections::HashMap;
use wasm_bindgen::prelude::*;

// Custom error type for vector operations
#[derive(Debug)]
pub enum VectorError {
    DimensionMismatch,
    InvalidInput,
    ComputationError,
}

impl std::fmt::Display for VectorError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            VectorError::DimensionMismatch => write!(f, "Vector dimensions do not match"),
            VectorError::InvalidInput => write!(f, "Invalid input provided"),
            VectorError::ComputationError => write!(f, "Error during computation"),
        }
    }
}

pub type VectorResult<T> = Result<T, VectorError>;

// 1024-dimensional vector operations for Voyage embeddings
#[wasm_bindgen]
pub struct Vector1024 {
    data: DVector<f32>,
}

#[wasm_bindgen]
impl Vector1024 {
    #[wasm_bindgen(constructor)]
    pub fn new(data: &[f32]) -> Result<Vector1024, JsValue> {
        if data.len() != 1024 {
            return Err(JsValue::from_str("Vector must be exactly 1024 dimensions"));
        }

        Ok(Vector1024 {
            data: DVector::from_column_slice(data),
        })
    }

    #[wasm_bindgen]
    pub fn from_js_array(data: &Float32Array) -> Result<Vector1024, JsValue> {
        if data.length() != 1024 {
            return Err(JsValue::from_str("Vector must be exactly 1024 dimensions"));
        }

        let vec_data: Vec<f32> = data.to_vec();
        Ok(Vector1024 {
            data: DVector::from_column_slice(&vec_data),
        })
    }

    #[wasm_bindgen]
    pub fn dot_product(&self, other: &Vector1024) -> f32 {
        self.data.dot(&other.data)
    }

    #[wasm_bindgen]
    pub fn magnitude(&self) -> f32 {
        self.data.norm()
    }

    #[wasm_bindgen]
    pub fn normalize(&self) -> Vector1024 {
        let normalized = self.data.normalize();
        Vector1024 { data: normalized }
    }

    #[wasm_bindgen]
    pub fn cosine_similarity(&self, other: &Vector1024) -> f32 {
        let dot = self.dot_product(other);
        let mag_product = self.magnitude() * other.magnitude();

        if mag_product == 0.0 {
            0.0
        } else {
            dot / mag_product
        }
    }

    #[wasm_bindgen]
    pub fn euclidean_distance(&self, other: &Vector1024) -> f32 {
        (&self.data - &other.data).norm()
    }

    #[wasm_bindgen]
    pub fn manhattan_distance(&self, other: &Vector1024) -> f32 {
        (&self.data - &other.data).iter().map(|x| x.abs()).sum()
    }

    #[wasm_bindgen]
    pub fn to_js_array(&self) -> Float32Array {
        let data: Vec<f32> = self.data.iter().cloned().collect();
        Float32Array::from(&data[..])
    }

    #[wasm_bindgen]
    pub fn scale(&self, factor: f32) -> Vector1024 {
        Vector1024 {
            data: &self.data * factor,
        }
    }

    #[wasm_bindgen]
    pub fn add(&self, other: &Vector1024) -> Vector1024 {
        Vector1024 {
            data: &self.data + &other.data,
        }
    }

    #[wasm_bindgen]
    pub fn subtract(&self, other: &Vector1024) -> Vector1024 {
        Vector1024 {
            data: &self.data - &other.data,
        }
    }
}

// Discovery feed scoring engine
#[wasm_bindgen]
pub struct DiscoveryScorer {
    user_preferences: Vector1024,
    content_weights: HashMap<String, f32>,
}

#[wasm_bindgen]
impl DiscoveryScorer {
    #[wasm_bindgen(constructor)]
    pub fn new(user_preferences: &Vector1024) -> DiscoveryScorer {
        let mut content_weights = HashMap::new();
        content_weights.insert("relevance".to_string(), 0.4);
        content_weights.insert("recency".to_string(), 0.3);
        content_weights.insert("popularity".to_string(), 0.2);
        content_weights.insert("diversity".to_string(), 0.1);

        DiscoveryScorer {
            user_preferences: Vector1024 {
                data: user_preferences.data.clone(),
            },
            content_weights,
        }
    }

    #[wasm_bindgen]
    pub fn score_content(
        &self,
        content_vector: &Vector1024,
        recency_score: f32,
        popularity_score: f32,
    ) -> f32 {
        // Relevance score based on cosine similarity
        let relevance = self.user_preferences.cosine_similarity(content_vector);

        // Diversity penalty (lower score for very similar content)
        let similarity_penalty = if relevance > 0.9 { 0.8 } else { 1.0 };

        // Multi-factor scoring
        let final_score = relevance * self.content_weights.get("relevance").unwrap_or(&0.4)
            + recency_score * self.content_weights.get("recency").unwrap_or(&0.3)
            + popularity_score * self.content_weights.get("popularity").unwrap_or(&0.2)
            + similarity_penalty * self.content_weights.get("diversity").unwrap_or(&0.1);

        final_score.clamp(0.0, 1.0)
    }

    #[wasm_bindgen]
    pub fn update_weights(
        &mut self,
        relevance: f32,
        recency: f32,
        popularity: f32,
        diversity: f32,
    ) {
        let total = relevance + recency + popularity + diversity;
        if total > 0.0 {
            self.content_weights
                .insert("relevance".to_string(), relevance / total);
            self.content_weights
                .insert("recency".to_string(), recency / total);
            self.content_weights
                .insert("popularity".to_string(), popularity / total);
            self.content_weights
                .insert("diversity".to_string(), diversity / total);
        }
    }
}

// Batch processing for user preference vectors
#[wasm_bindgen]
pub struct BatchProcessor {
    batch_size: usize,
}

#[wasm_bindgen]
impl BatchProcessor {
    #[wasm_bindgen(constructor)]
    pub fn new(batch_size: usize) -> BatchProcessor {
        BatchProcessor { batch_size }
    }

    #[wasm_bindgen]
    pub fn process_similarity_batch(
        &self,
        query_vector: &Vector1024,
        vectors_data: &Float32Array,
    ) -> Float32Array {
        let vectors_len = vectors_data.length() as usize;
        let num_vectors = vectors_len / 1024;
        let mut similarities = Vec::with_capacity(num_vectors);

        let data: Vec<f32> = vectors_data.to_vec();

        for i in 0..num_vectors {
            let start_idx = i * 1024;
            let end_idx = start_idx + 1024;

            if end_idx <= data.len() {
                let vector_slice = &data[start_idx..end_idx];
                if let Ok(vector) = Vector1024::new(vector_slice) {
                    let similarity = query_vector.cosine_similarity(&vector);
                    similarities.push(similarity);
                } else {
                    similarities.push(0.0);
                }
            } else {
                similarities.push(0.0);
            }
        }

        Float32Array::from(&similarities[..])
    }

    #[wasm_bindgen]
    pub fn find_top_k_similar(
        &self,
        query_vector: &Vector1024,
        vectors_data: &Float32Array,
        k: usize,
    ) -> Float32Array {
        let similarities = self.process_similarity_batch(query_vector, vectors_data);
        let mut similarity_vec: Vec<(f32, usize)> = similarities
            .to_vec()
            .iter()
            .enumerate()
            .map(|(idx, &sim)| (sim, idx))
            .collect();

        // Sort by similarity (descending)
        similarity_vec.sort_by(|a, b| b.0.partial_cmp(&a.0).unwrap());

        // Take top k
        let top_k: Vec<f32> = similarity_vec
            .iter()
            .take(k.min(similarity_vec.len()))
            .map(|(sim, _)| *sim)
            .collect();

        Float32Array::from(&top_k[..])
    }

    #[wasm_bindgen]
    pub fn compute_centroid(&self, vectors_data: &Float32Array) -> Result<Vector1024, JsValue> {
        let vectors_len = vectors_data.length() as usize;
        let num_vectors = vectors_len / 1024;

        if num_vectors == 0 {
            return Err(JsValue::from_str("No vectors provided"));
        }

        let data: Vec<f32> = vectors_data.to_vec();
        let mut centroid = vec![0.0f32; 1024];

        for i in 0..num_vectors {
            let start_idx = i * 1024;
            let end_idx = start_idx + 1024;

            if end_idx <= data.len() {
                for (j, &value) in data[start_idx..end_idx].iter().enumerate() {
                    centroid[j] += value;
                }
            }
        }

        // Average
        for value in centroid.iter_mut() {
            *value /= num_vectors as f32;
        }

        Vector1024::new(&centroid)
    }
}

// High-level convenience functions
#[wasm_bindgen]
pub fn compute_batch_similarities(
    query_data: &[f32],
    vectors_data: &Float32Array,
) -> Result<Float32Array, JsValue> {
    let query_vector = Vector1024::new(query_data)?;
    let processor = BatchProcessor::new(100);
    Ok(processor.process_similarity_batch(&query_vector, vectors_data))
}

#[wasm_bindgen]
pub fn find_most_similar_vectors(
    query_data: &[f32],
    vectors_data: &Float32Array,
    k: usize,
) -> Result<Float32Array, JsValue> {
    let query_vector = Vector1024::new(query_data)?;
    let processor = BatchProcessor::new(100);
    Ok(processor.find_top_k_similar(&query_vector, vectors_data, k))
}

#[wasm_bindgen]
pub fn score_content_batch(
    user_prefs: &[f32],
    content_vectors: &Float32Array,
    recency_scores: &[f32],
    popularity_scores: &[f32],
) -> Result<Float32Array, JsValue> {
    let user_vector = Vector1024::new(user_prefs)?;
    let scorer = DiscoveryScorer::new(&user_vector);

    let vectors_len = content_vectors.length() as usize;
    let num_vectors = vectors_len / 768;
    let content_data: Vec<f32> = content_vectors.to_vec();

    let mut scores = Vec::with_capacity(num_vectors);

    for i in 0..num_vectors {
        let start_idx = i * 768;
        let end_idx = start_idx + 768;

        if end_idx <= content_data.len() && i < recency_scores.len() && i < popularity_scores.len()
        {
            let vector_slice = &content_data[start_idx..end_idx];
            if let Ok(content_vector) = Vector1024::new(vector_slice) {
                let score =
                    scorer.score_content(&content_vector, recency_scores[i], popularity_scores[i]);
                scores.push(score);
            } else {
                scores.push(0.0);
            }
        } else {
            scores.push(0.0);
        }
    }

    Ok(Float32Array::from(&scores[..]))
}

// Enhanced vector operations for optimization
#[wasm_bindgen]
pub fn batch_normalize_vectors(vectors: &Float32Array) -> Result<Float32Array, JsValue> {
    let mut data: Vec<f32> = vectors.to_vec();
    let vector_len = 1024;
    let num_vectors = data.len() / vector_len;

    if data.len() % vector_len != 0 {
        return Err(JsValue::from_str(
            "Vector data length must be divisible by 1024",
        ));
    }

    // Process each vector
    for i in 0..num_vectors {
        let start_idx = i * vector_len;
        let end_idx = start_idx + vector_len;
        let vector_slice = &mut data[start_idx..end_idx];

        // Calculate magnitude
        let magnitude: f32 = vector_slice.iter().map(|x| x * x).sum::<f32>().sqrt();

        if magnitude > 0.0 {
            // Normalize in place
            for element in vector_slice.iter_mut() {
                *element /= magnitude;
            }
        }
    }

    Ok(Float32Array::from(&data[..]))
}

#[wasm_bindgen]
pub fn compute_diversity_scores(vectors: &Float32Array, threshold: f32) -> Float32Array {
    let data: Vec<f32> = vectors.to_vec();
    let vector_len = 1024;
    let num_vectors = data.len() / vector_len;
    let mut diversity_scores = vec![1.0f32; num_vectors];

    // Compare each vector with all others
    for i in 0..num_vectors {
        let mut penalty = 0.0f32;
        let start_i = i * vector_len;
        let end_i = start_i + vector_len;
        let vec_i = &data[start_i..end_i];

        for j in 0..num_vectors {
            if i != j {
                let start_j = j * vector_len;
                let end_j = start_j + vector_len;
                let vec_j = &data[start_j..end_j];

                // Compute cosine similarity
                let dot_product: f32 = vec_i.iter().zip(vec_j.iter()).map(|(a, b)| a * b).sum();
                let norm_i: f32 = vec_i.iter().map(|x| x * x).sum::<f32>().sqrt();
                let norm_j: f32 = vec_j.iter().map(|x| x * x).sum::<f32>().sqrt();

                if norm_i > 0.0 && norm_j > 0.0 {
                    let similarity = dot_product / (norm_i * norm_j);
                    if similarity > threshold {
                        penalty += similarity - threshold;
                    }
                }
            }
        }

        // Apply diversity penalty
        diversity_scores[i] = (1.0 - penalty.min(1.0)).max(0.0);
    }

    Float32Array::from(&diversity_scores[..])
}

#[wasm_bindgen]
pub fn apply_temporal_decay(scores: &Float32Array, timestamps: &[u64]) -> Float32Array {
    if scores.length() as usize != timestamps.len() {
        return scores.clone(); // Return original if mismatched lengths
    }

    let mut decayed_scores: Vec<f32> = scores.to_vec();
    let current_time = js_sys::Date::now() as u64;
    let day_ms = 24 * 60 * 60 * 1000; // milliseconds in a day

    for i in 0..timestamps.len() {
        let age_days = ((current_time - timestamps[i]) / day_ms) as f32;

        // Exponential decay: score * e^(-0.1 * age_days)
        let decay_factor = (-0.1 * age_days).exp();
        decayed_scores[i] *= decay_factor;
    }

    Float32Array::from(&decayed_scores[..])
}

// Simplified post structure for privacy filtering
#[wasm_bindgen]
#[derive(Clone)]
pub struct PostInfo {
    id: u32,
    user_id: u32,
    is_private: bool,
    hashtags: Vec<String>,
}

#[wasm_bindgen]
impl PostInfo {
    #[wasm_bindgen(constructor)]
    pub fn new(id: u32, user_id: u32, is_private: bool) -> PostInfo {
        PostInfo {
            id,
            user_id,
            is_private,
            hashtags: Vec::new(),
        }
    }

    #[wasm_bindgen]
    pub fn add_hashtag(&mut self, hashtag: String) {
        self.hashtags.push(hashtag);
    }

    #[wasm_bindgen(getter)]
    pub fn id(&self) -> u32 {
        self.id
    }

    #[wasm_bindgen(getter)]
    pub fn user_id(&self) -> u32 {
        self.user_id
    }

    #[wasm_bindgen(getter)]
    pub fn is_private(&self) -> bool {
        self.is_private
    }
}

#[wasm_bindgen]
#[derive(Clone)]
pub struct UserPermission {
    user_id: u32,
    blocked_users: Vec<u32>,
    following: Vec<u32>,
}

#[wasm_bindgen]
impl UserPermission {
    #[wasm_bindgen(constructor)]
    pub fn new(user_id: u32) -> UserPermission {
        UserPermission {
            user_id,
            blocked_users: Vec::new(),
            following: Vec::new(),
        }
    }

    #[wasm_bindgen]
    pub fn add_blocked_user(&mut self, blocked_user_id: u32) {
        self.blocked_users.push(blocked_user_id);
    }

    #[wasm_bindgen]
    pub fn add_following(&mut self, following_user_id: u32) {
        self.following.push(following_user_id);
    }

    #[wasm_bindgen(getter)]
    pub fn user_id(&self) -> u32 {
        self.user_id
    }
}

#[wasm_bindgen]
pub fn batch_privacy_filter(
    post_user_ids: &js_sys::Uint32Array,
    is_private_flags: &js_sys::Uint8Array,
    user_permission: &UserPermission,
) -> js_sys::Uint32Array {
    let mut filtered_indices = Vec::new();

    let user_ids = post_user_ids.to_vec();
    let private_flags = is_private_flags.to_vec();

    let min_len = user_ids.len().min(private_flags.len());

    for i in 0..min_len {
        let post_user_id = user_ids[i];
        let is_private = private_flags[i] != 0;

        let should_include = if is_private {
            // Private posts: only if user is following the author or is the author
            post_user_id == user_permission.user_id()
                || user_permission.following.contains(&post_user_id)
        } else {
            // Public posts: exclude if author is blocked
            !user_permission.blocked_users.contains(&post_user_id)
        };

        if should_include {
            filtered_indices.push(i as u32);
        }
    }

    js_sys::Uint32Array::from(&filtered_indices[..])
}

// VectorPool for efficient memory management
#[wasm_bindgen]
pub struct VectorPool {
    vectors: Vec<Vec<f32>>,
    available: Vec<usize>,
    max_size: usize,
    vector_size: usize,
}

#[wasm_bindgen]
impl VectorPool {
    #[wasm_bindgen(constructor)]
    pub fn new(max_size: usize, vector_size: usize) -> VectorPool {
        let mut vectors = Vec::with_capacity(max_size);
        let mut available = Vec::with_capacity(max_size);

        // Pre-allocate vectors
        for i in 0..max_size {
            vectors.push(vec![0.0f32; vector_size]);
            available.push(i);
        }

        VectorPool {
            vectors,
            available,
            max_size,
            vector_size,
        }
    }

    #[wasm_bindgen]
    pub fn get_vector(&mut self) -> Option<usize> {
        self.available.pop()
    }

    #[wasm_bindgen]
    pub fn release_vector(&mut self, index: usize) -> bool {
        if index < self.vectors.len() && !self.available.contains(&index) {
            // Clear the vector for reuse
            for element in &mut self.vectors[index] {
                *element = 0.0;
            }
            self.available.push(index);
            true
        } else {
            false
        }
    }

    #[wasm_bindgen]
    pub fn get_vector_data(&self, index: usize) -> Option<Float32Array> {
        if index < self.vectors.len() {
            Some(Float32Array::from(&self.vectors[index][..]))
        } else {
            None
        }
    }

    #[wasm_bindgen]
    pub fn set_vector_data(&mut self, index: usize, data: &Float32Array) -> bool {
        if index < self.vectors.len() && data.length() as usize == self.vector_size {
            let vec_data: Vec<f32> = data.to_vec();
            self.vectors[index].copy_from_slice(&vec_data);
            true
        } else {
            false
        }
    }

    #[wasm_bindgen]
    pub fn available_count(&self) -> usize {
        self.available.len()
    }

    #[wasm_bindgen]
    pub fn total_capacity(&self) -> usize {
        self.max_size
    }

    #[wasm_bindgen]
    pub fn in_use_count(&self) -> usize {
        self.max_size - self.available.len()
    }

    #[wasm_bindgen]
    pub fn resize_pool(&mut self, new_size: usize) -> bool {
        if new_size < self.in_use_count() {
            // Cannot shrink below currently used vectors
            return false;
        }

        if new_size > self.max_size {
            // Expand the pool
            let old_size = self.max_size;
            for i in old_size..new_size {
                self.vectors.push(vec![0.0f32; self.vector_size]);
                self.available.push(i);
            }
        } else if new_size < self.max_size {
            // Shrink the pool
            self.vectors.truncate(new_size);
            self.available.retain(|&x| x < new_size);
        }

        self.max_size = new_size;
        true
    }

    #[wasm_bindgen]
    pub fn reset_pool(&mut self) {
        self.available.clear();
        for i in 0..self.max_size {
            for element in &mut self.vectors[i] {
                *element = 0.0;
            }
            self.available.push(i);
        }
    }
}

// Global VectorPool instance for performance
static mut GLOBAL_VECTOR_POOL: Option<VectorPool> = None;

#[wasm_bindgen]
pub fn initialize_global_vector_pool(max_size: usize, vector_size: usize) {
    unsafe {
        GLOBAL_VECTOR_POOL = Some(VectorPool::new(max_size, vector_size));
    }
}

#[wasm_bindgen]
pub fn get_global_vector() -> Option<usize> {
    unsafe {
        if let Some(ref mut pool) = GLOBAL_VECTOR_POOL {
            pool.get_vector()
        } else {
            None
        }
    }
}

#[wasm_bindgen]
pub fn release_global_vector(index: usize) -> bool {
    unsafe {
        if let Some(ref mut pool) = GLOBAL_VECTOR_POOL {
            pool.release_vector(index)
        } else {
            false
        }
    }
}

#[wasm_bindgen]
pub fn get_global_pool_stats() -> js_sys::Array {
    let stats = js_sys::Array::new();

    unsafe {
        if let Some(ref pool) = GLOBAL_VECTOR_POOL {
            stats.push(&pool.total_capacity().into());
            stats.push(&pool.available_count().into());
            stats.push(&pool.in_use_count().into());
        } else {
            stats.push(&0u32.into());
            stats.push(&0u32.into());
            stats.push(&0u32.into());
        }
    }

    stats
}

// High-performance batch operations using VectorPool
#[wasm_bindgen]
pub struct BatchVectorProcessor {
    pool: VectorPool,
}

#[wasm_bindgen]
impl BatchVectorProcessor {
    #[wasm_bindgen(constructor)]
    pub fn new(pool_size: usize) -> BatchVectorProcessor {
        BatchVectorProcessor {
            pool: VectorPool::new(pool_size, 1024),
        }
    }

    #[wasm_bindgen]
    pub fn process_similarity_batch_pooled(
        &mut self,
        query_vector: &Float32Array,
        vectors_data: &Float32Array,
    ) -> Option<Float32Array> {
        let query_index = self.pool.get_vector()?;

        // Set query vector data
        if !self.pool.set_vector_data(query_index, query_vector) {
            self.pool.release_vector(query_index);
            return None;
        }

        let vectors_len = vectors_data.length() as usize;
        let num_vectors = vectors_len / 1024;
        let mut similarities = Vec::with_capacity(num_vectors);
        let data: Vec<f32> = vectors_data.to_vec();

        // Process each target vector
        for i in 0..num_vectors {
            if let Some(target_index) = self.pool.get_vector() {
                let start_idx = i * 1024;
                let end_idx = start_idx + 1024;

                if end_idx <= data.len() {
                    let vector_slice = &data[start_idx..end_idx];
                    let target_array = Float32Array::from(vector_slice);

                    if self.pool.set_vector_data(target_index, &target_array) {
                        // Compute similarity using pool vectors
                        let query_data = self.pool.get_vector_data(query_index)?;
                        let target_data = self.pool.get_vector_data(target_index)?;

                        let similarity =
                            compute_cosine_similarity_from_arrays(&query_data, &target_data);
                        similarities.push(similarity);
                    } else {
                        similarities.push(0.0);
                    }
                } else {
                    similarities.push(0.0);
                }

                self.pool.release_vector(target_index);
            } else {
                similarities.push(0.0);
            }
        }

        // Release query vector
        self.pool.release_vector(query_index);

        Some(Float32Array::from(&similarities[..]))
    }

    #[wasm_bindgen]
    pub fn get_pool_stats(&self) -> js_sys::Array {
        let stats = js_sys::Array::new();
        stats.push(&self.pool.total_capacity().into());
        stats.push(&self.pool.available_count().into());
        stats.push(&self.pool.in_use_count().into());
        stats
    }
}

// Helper function for cosine similarity computation
fn compute_cosine_similarity_from_arrays(vec1: &Float32Array, vec2: &Float32Array) -> f32 {
    if vec1.length() != vec2.length() {
        return 0.0;
    }

    let data1: Vec<f32> = vec1.to_vec();
    let data2: Vec<f32> = vec2.to_vec();

    let dot_product: f32 = data1.iter().zip(data2.iter()).map(|(a, b)| a * b).sum();
    let norm1: f32 = data1.iter().map(|x| x * x).sum::<f32>().sqrt();
    let norm2: f32 = data2.iter().map(|x| x * x).sum::<f32>().sqrt();

    if norm1 > 0.0 && norm2 > 0.0 {
        dot_product / (norm1 * norm2)
    } else {
        0.0
    }
}
