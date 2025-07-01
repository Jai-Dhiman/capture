use base64::prelude::*;
use js_sys::{Array, Object, Reflect, Uint8Array};
use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;
use wasm_bindgen_futures::JsFuture;
use web_sys::{CryptoKey, SubtleCrypto};

#[derive(Debug, Serialize, Deserialize)]
pub struct JwtHeader {
    pub alg: String,
    pub typ: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct JwtPayload {
    pub sub: String, // user_id
    pub email: String,
    pub iat: i64, // issued at
    pub exp: i64, // expires at
}

pub struct JwtCrypto;

impl JwtCrypto {
    /// Create a proper JWT with HMAC-SHA256 signature
    pub async fn create_jwt(
        user_id: &str,
        email: &str,
        exp: i64,
        jwt_secret: &str,
    ) -> Result<String, JsValue> {
        let iat = chrono::Utc::now().timestamp();

        // Create JWT header
        let header = JwtHeader {
            alg: "HS256".to_string(),
            typ: "JWT".to_string(),
        };

        // Create JWT payload
        let payload = JwtPayload {
            sub: user_id.to_string(),
            email: email.to_string(),
            iat,
            exp,
        };

        // Encode header and payload
        let header_json = serde_json::to_string(&header)
            .map_err(|e| JsValue::from_str(&format!("Header serialization error: {}", e)))?;
        let payload_json = serde_json::to_string(&payload)
            .map_err(|e| JsValue::from_str(&format!("Payload serialization error: {}", e)))?;

        let header_b64 = Self::base64_url_encode(&header_json);
        let payload_b64 = Self::base64_url_encode(&payload_json);

        // Create signature data
        let signature_data = format!("{}.{}", header_b64, payload_b64);

        // Sign with HMAC-SHA256
        let signature = Self::hmac_sha256_sign(&signature_data, jwt_secret).await?;
        let signature_b64 = Self::base64_url_encode_bytes(&signature);

        // Return complete JWT
        Ok(format!("{}.{}.{}", header_b64, payload_b64, signature_b64))
    }

    /// Verify a JWT token and return the payload
    pub async fn verify_jwt(token: &str, jwt_secret: &str) -> Result<JwtPayload, JsValue> {
        let parts: Vec<&str> = token.split('.').collect();
        if parts.len() != 3 {
            return Err(JsValue::from_str("Invalid JWT format"));
        }

        let header_b64 = parts[0];
        let payload_b64 = parts[1];
        let signature_b64 = parts[2];

        // Verify signature
        let signature_data = format!("{}.{}", header_b64, payload_b64);
        let expected_signature = Self::hmac_sha256_sign(&signature_data, jwt_secret).await?;
        let expected_signature_b64 = Self::base64_url_encode_bytes(&expected_signature);

        if signature_b64 != expected_signature_b64 {
            return Err(JsValue::from_str("Invalid JWT signature"));
        }

        // Decode and parse payload
        let payload_json = Self::base64_url_decode(payload_b64)
            .map_err(|e| JsValue::from_str(&format!("Payload decode error: {}", e)))?;

        let payload: JwtPayload = serde_json::from_str(&payload_json)
            .map_err(|e| JsValue::from_str(&format!("Payload parse error: {}", e)))?;

        // Check expiration
        let now = chrono::Utc::now().timestamp();
        if payload.exp < now {
            return Err(JsValue::from_str("Token has expired"));
        }

        Ok(payload)
    }

    /// Sign data with HMAC-SHA256 using Web Crypto API
    async fn hmac_sha256_sign(data: &str, secret: &str) -> Result<Vec<u8>, JsValue> {
        // Get the global crypto object
        let crypto = Self::get_crypto()?;
        let subtle = crypto.subtle();

        // Import the secret key
        let key = Self::import_hmac_key(&subtle, secret).await?;

        // Convert data to bytes
        let data_bytes = data.as_bytes();
        let signature_promise = subtle.sign_with_str_and_u8_array("HMAC", &key, data_bytes)?;
        let signature_result = JsFuture::from(signature_promise).await?;

        // Convert ArrayBuffer to Vec<u8>
        let signature_buffer = js_sys::ArrayBuffer::from(signature_result);
        let signature_array = Uint8Array::new(&signature_buffer);
        let mut signature_vec = vec![0u8; signature_array.length() as usize];
        signature_array.copy_to(&mut signature_vec);

        Ok(signature_vec)
    }

    /// Import HMAC key for signing/verification
    async fn import_hmac_key(subtle: &SubtleCrypto, secret: &str) -> Result<CryptoKey, JsValue> {
        let secret_array = Uint8Array::from(secret.as_bytes());

        // Create key import parameters
        let import_params = Object::new();
        Reflect::set(&import_params, &"name".into(), &"HMAC".into())?;

        let hash_params = Object::new();
        Reflect::set(&hash_params, &"name".into(), &"SHA-256".into())?;
        Reflect::set(&import_params, &"hash".into(), &hash_params)?;

        // Import the key
        let key_promise = subtle.import_key_with_object(
            "raw",
            &secret_array,
            &import_params,
            false, // not extractable
            &Array::of2(&"sign".into(), &"verify".into()),
        )?;

        let key_result = JsFuture::from(key_promise).await?;
        Ok(CryptoKey::from(key_result))
    }

    /// Get the global crypto object
    fn get_crypto() -> Result<web_sys::Crypto, JsValue> {
        let global = js_sys::global();
        let crypto_val = Reflect::get(&global, &"crypto".into())?;
        Ok(web_sys::Crypto::from(crypto_val))
    }

    /// Base64 URL encode a string
    fn base64_url_encode(input: &str) -> String {
        let encoded = BASE64_STANDARD.encode(input.as_bytes());
        Self::base64_to_base64url(&encoded)
    }

    /// Base64 URL encode bytes
    fn base64_url_encode_bytes(input: &[u8]) -> String {
        let encoded = BASE64_STANDARD.encode(input);
        Self::base64_to_base64url(&encoded)
    }

    /// Convert base64 to base64url
    fn base64_to_base64url(input: &str) -> String {
        input.replace('+', "-").replace('/', "_").replace('=', "")
    }

    /// Base64 URL decode
    fn base64_url_decode(input: &str) -> Result<String, Box<dyn std::error::Error>> {
        // Add padding if necessary
        let mut padded = input.to_string();
        while padded.len() % 4 != 0 {
            padded.push('=');
        }

        // Replace url-safe characters
        let base64 = padded.replace('-', "+").replace('_', "/");

        // Decode
        let decoded_bytes = BASE64_STANDARD.decode(base64)?;
        let decoded_string = String::from_utf8(decoded_bytes)?;

        Ok(decoded_string)
    }
}
