use base64::{engine::general_purpose, Engine as _};
use hmac::{Hmac, Mac};
use rand::Rng;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256, Sha512};
use wasm_bindgen::prelude::*;

type HmacSha256 = Hmac<Sha256>;

#[wasm_bindgen]
pub struct CryptoProcessor {
    // No need for persistent RNG state in WASM
}

#[derive(Serialize, Deserialize)]
pub struct JwtPayload {
    pub sub: String,
    pub exp: u64,
    pub iat: u64,
    pub iss: String,
}

#[wasm_bindgen]
impl CryptoProcessor {
    #[wasm_bindgen(constructor)]
    pub fn new() -> CryptoProcessor {
        CryptoProcessor {}
    }

    #[wasm_bindgen]
    pub fn sha256(&self, data: &[u8]) -> Vec<u8> {
        let mut hasher = Sha256::new();
        hasher.update(data);
        hasher.finalize().to_vec()
    }

    #[wasm_bindgen]
    pub fn sha256_hex(&self, data: &[u8]) -> String {
        let hash = self.sha256(data);
        hex::encode(hash)
    }

    #[wasm_bindgen]
    pub fn sha512(&self, data: &[u8]) -> Vec<u8> {
        let mut hasher = Sha512::new();
        hasher.update(data);
        hasher.finalize().to_vec()
    }

    #[wasm_bindgen]
    pub fn sha512_hex(&self, data: &[u8]) -> String {
        let hash = self.sha512(data);
        hex::encode(hash)
    }

    #[wasm_bindgen]
    pub fn hmac_sha256(&self, key: &[u8], data: &[u8]) -> Result<Vec<u8>, JsValue> {
        let mut mac = HmacSha256::new_from_slice(key)
            .map_err(|e| JsValue::from_str(&format!("Invalid key length: {}", e)))?;
        mac.update(data);
        Ok(mac.finalize().into_bytes().to_vec())
    }

    #[wasm_bindgen]
    pub fn hmac_sha256_hex(&self, key: &[u8], data: &[u8]) -> Result<String, JsValue> {
        let hmac_result = self.hmac_sha256(key, data)?;
        Ok(hex::encode(hmac_result))
    }

    #[wasm_bindgen]
    pub fn hmac_sha256_base64(&self, key: &[u8], data: &[u8]) -> Result<String, JsValue> {
        let hmac_result = self.hmac_sha256(key, data)?;
        Ok(general_purpose::STANDARD.encode(hmac_result))
    }

    #[wasm_bindgen]
    pub fn verify_hmac_sha256(&self, key: &[u8], data: &[u8], signature: &[u8]) -> bool {
        match self.hmac_sha256(key, data) {
            Ok(computed) => computed == signature,
            Err(_) => false,
        }
    }

    #[wasm_bindgen]
    pub fn generate_random_bytes(&self, length: usize) -> Result<Vec<u8>, JsValue> {
        let mut rng = rand::thread_rng();
        let mut bytes = vec![0u8; length];
        rng.fill(&mut bytes[..]);
        Ok(bytes)
    }

    #[wasm_bindgen]
    pub fn generate_random_hex(&self, length: usize) -> Result<String, JsValue> {
        let bytes = self.generate_random_bytes(length)?;
        Ok(hex::encode(bytes))
    }

    #[wasm_bindgen]
    pub fn sign_url(&self, url: &str, secret: &[u8], expiration: u64) -> Result<String, JsValue> {
        let timestamp = js_sys::Date::now() as u64 / 1000;
        let expires = timestamp + expiration;

        let message = format!("{}:{}", url, expires);
        let signature = self.hmac_sha256_base64(secret, message.as_bytes())?;

        let separator = if url.contains('?') { "&" } else { "?" };
        Ok(format!(
            "{}{}expires={}&signature={}",
            url, separator, expires, signature
        ))
    }

    #[wasm_bindgen]
    pub fn verify_signed_url(&self, signed_url: &str, secret: &[u8]) -> bool {
        // Parse URL to extract original URL, expires, and signature
        if let Some(query_start) = signed_url.find('?') {
            let (base_url, query) = signed_url.split_at(query_start + 1);
            let base_url = &base_url[..query_start];

            let params: std::collections::HashMap<&str, &str> = query
                .split('&')
                .filter_map(|param| {
                    let mut parts = param.split('=');
                    match (parts.next(), parts.next()) {
                        (Some(key), Some(value)) => Some((key, value)),
                        _ => None,
                    }
                })
                .collect();

            if let (Some(expires_str), Some(signature)) =
                (params.get("expires"), params.get("signature"))
            {
                if let Ok(expires) = expires_str.parse::<u64>() {
                    let current_time = js_sys::Date::now() as u64 / 1000;
                    if current_time > expires {
                        return false; // Expired
                    }

                    let message = format!("{}:{}", base_url, expires);
                    if let Ok(expected_signature) =
                        self.hmac_sha256_base64(secret, message.as_bytes())
                    {
                        return expected_signature == *signature;
                    }
                }
            }
        }
        false
    }

    #[wasm_bindgen]
    pub fn sign_request(
        &self,
        method: &str,
        url: &str,
        body: &[u8],
        secret: &[u8],
    ) -> Result<String, JsValue> {
        let timestamp = js_sys::Date::now() as u64 / 1000;
        let body_hash = self.sha256_hex(body);

        let string_to_sign = format!(
            "{}:{}\n{}\n{}",
            method.to_uppercase(),
            url,
            timestamp,
            body_hash
        );
        let signature = self.hmac_sha256_base64(secret, string_to_sign.as_bytes())?;

        Ok(format!("timestamp={}&signature={}", timestamp, signature))
    }

    #[wasm_bindgen]
    pub fn verify_request_signature(
        &self,
        method: &str,
        url: &str,
        body: &[u8],
        secret: &[u8],
        timestamp: u64,
        signature: &str,
        max_age: u64,
    ) -> bool {
        let current_time = js_sys::Date::now() as u64 / 1000;
        if current_time - timestamp > max_age {
            return false; // Too old
        }

        let body_hash = self.sha256_hex(body);
        let string_to_sign = format!(
            "{}:{}\n{}\n{}",
            method.to_uppercase(),
            url,
            timestamp,
            body_hash
        );

        if let Ok(expected_signature) = self.hmac_sha256_base64(secret, string_to_sign.as_bytes()) {
            return expected_signature == signature;
        }
        false
    }

    #[wasm_bindgen]
    pub fn create_jwt(&self, payload: &str, secret: &[u8]) -> Result<String, JsValue> {
        let header = r#"{"alg":"HS256","typ":"JWT"}"#;
        let header_b64 = general_purpose::URL_SAFE_NO_PAD.encode(header.as_bytes());
        let payload_b64 = general_purpose::URL_SAFE_NO_PAD.encode(payload.as_bytes());

        let message = format!("{}.{}", header_b64, payload_b64);
        let signature = self.hmac_sha256(secret, message.as_bytes())?;
        let signature_b64 = general_purpose::URL_SAFE_NO_PAD.encode(signature);

        Ok(format!("{}.{}", message, signature_b64))
    }

    #[wasm_bindgen]
    pub fn verify_jwt(&self, token: &str, secret: &[u8]) -> bool {
        let parts: Vec<&str> = token.split('.').collect();
        if parts.len() != 3 {
            return false;
        }

        let message = format!("{}.{}", parts[0], parts[1]);
        if let Ok(expected_signature) = self.hmac_sha256(secret, message.as_bytes()) {
            if let Ok(provided_signature) = general_purpose::URL_SAFE_NO_PAD.decode(parts[2]) {
                return expected_signature == provided_signature;
            }
        }
        false
    }

    #[wasm_bindgen]
    pub fn decode_jwt_payload(&self, token: &str) -> Result<String, JsValue> {
        let parts: Vec<&str> = token.split('.').collect();
        if parts.len() != 3 {
            return Err(JsValue::from_str("Invalid JWT format"));
        }

        let payload_bytes = general_purpose::URL_SAFE_NO_PAD
            .decode(parts[1])
            .map_err(|e| JsValue::from_str(&format!("Invalid base64: {}", e)))?;

        String::from_utf8(payload_bytes)
            .map_err(|e| JsValue::from_str(&format!("Invalid UTF-8: {}", e)))
    }
}

// Utility functions
#[wasm_bindgen]
pub fn hex_encode(data: &[u8]) -> String {
    hex::encode(data)
}

#[wasm_bindgen]
pub fn hex_decode(hex_str: &str) -> Result<Vec<u8>, JsValue> {
    hex::decode(hex_str).map_err(|e| JsValue::from_str(&format!("Invalid hex: {}", e)))
}

#[wasm_bindgen]
pub fn base64_encode(data: &[u8]) -> String {
    general_purpose::STANDARD.encode(data)
}

#[wasm_bindgen]
pub fn base64_decode(b64_str: &str) -> Result<Vec<u8>, JsValue> {
    general_purpose::STANDARD
        .decode(b64_str)
        .map_err(|e| JsValue::from_str(&format!("Invalid base64: {}", e)))
}

#[wasm_bindgen]
pub fn base64_url_encode(data: &[u8]) -> String {
    general_purpose::URL_SAFE_NO_PAD.encode(data)
}

#[wasm_bindgen]
pub fn base64_url_decode(b64_str: &str) -> Result<Vec<u8>, JsValue> {
    general_purpose::URL_SAFE_NO_PAD
        .decode(b64_str)
        .map_err(|e| JsValue::from_str(&format!("Invalid base64url: {}", e)))
}

// Performance comparison functions
#[wasm_bindgen]
pub fn benchmark_hmac_operations(iterations: u32) -> f64 {
    let processor = CryptoProcessor::new();
    let key = b"test-key-for-benchmarking-purposes";
    let data = b"test data for hmac benchmarking with reasonable length";

    let start = js_sys::Date::now();
    for _ in 0..iterations {
        let _ = processor.hmac_sha256(key, data);
    }
    let end = js_sys::Date::now();

    (end - start) / iterations as f64
}

#[wasm_bindgen]
pub fn benchmark_sha256_operations(iterations: u32) -> f64 {
    let processor = CryptoProcessor::new();
    let data = b"test data for sha256 benchmarking with reasonable length content";

    let start = js_sys::Date::now();
    for _ in 0..iterations {
        let _ = processor.sha256(data);
    }
    let end = js_sys::Date::now();

    (end - start) / iterations as f64
}
