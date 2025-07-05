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
