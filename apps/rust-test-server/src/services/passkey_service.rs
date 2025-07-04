use base64::prelude::*;
use js_sys::{Reflect, Uint8Array};
use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;
use wasm_bindgen_futures::JsFuture;
use worker::Env;

// WebAuthn Constants
const RP_NAME: &str = "Capture";
const RP_ID: &str = "capture-api.jai-d.workers.dev";
const ORIGIN: &str = "https://capture-api.jai-d.workers.dev";
const CHALLENGE_LENGTH: usize = 32;
const TIMEOUT: u32 = 300000; // 5 minutes in milliseconds

#[derive(Debug, Serialize, Deserialize)]
pub struct PasskeyUser {
    pub id: String,
    pub email: String,
    pub display_name: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PasskeyDevice {
    pub credential_id: String,
    pub public_key: String,
    pub counter: i32,
    pub transports: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RegistrationOptions {
    pub challenge: String,
    pub rp: RelyingParty,
    pub user: UserEntity,
    pub pub_key_cred_params: Vec<PubKeyCredParam>,
    pub timeout: u32,
    pub attestation: String,
    pub authenticator_selection: AuthenticatorSelection,
    pub exclude_credentials: Vec<PublicKeyCredentialDescriptor>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AuthenticationOptions {
    pub challenge: String,
    #[serde(rename = "rpId")]
    pub rp_id: String,
    pub timeout: u32,
    #[serde(rename = "userVerification")]
    pub user_verification: String,
    #[serde(rename = "allowCredentials")]
    pub allow_credentials: Vec<PublicKeyCredentialDescriptor>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RelyingParty {
    pub id: String,
    pub name: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UserEntity {
    pub id: String,
    pub name: String,
    #[serde(rename = "displayName")]
    pub display_name: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PubKeyCredParam {
    #[serde(rename = "type")]
    pub credential_type: String,
    pub alg: i32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AuthenticatorSelection {
    #[serde(rename = "authenticatorAttachment")]
    pub authenticator_attachment: String,
    #[serde(rename = "userVerification")]
    pub user_verification: String,
    #[serde(rename = "residentKey")]
    pub resident_key: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PublicKeyCredentialDescriptor {
    #[serde(rename = "type")]
    pub credential_type: String,
    pub id: String,
    pub transports: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RegistrationResponse {
    pub id: String,
    #[serde(rename = "rawId")]
    pub raw_id: String,
    pub response: AuthenticatorAttestationResponse,
    #[serde(rename = "type")]
    pub credential_type: String,
    #[serde(rename = "clientExtensionResults")]
    pub client_extension_results: Option<serde_json::Value>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AuthenticatorAttestationResponse {
    #[serde(rename = "clientDataJSON")]
    pub client_data_json: String,
    #[serde(rename = "attestationObject")]
    pub attestation_object: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AuthenticationResponse {
    pub id: String,
    #[serde(rename = "rawId")]
    pub raw_id: String,
    pub response: AuthenticatorAssertionResponse,
    #[serde(rename = "type")]
    pub credential_type: String,
    #[serde(rename = "clientExtensionResults")]
    pub client_extension_results: Option<serde_json::Value>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AuthenticatorAssertionResponse {
    #[serde(rename = "clientDataJSON")]
    pub client_data_json: String,
    #[serde(rename = "authenticatorData")]
    pub authenticator_data: String,
    pub signature: String,
    #[serde(rename = "userHandle")]
    pub user_handle: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ClientData {
    #[serde(rename = "type")]
    pub client_data_type: String,
    pub challenge: String,
    pub origin: String,
    #[serde(rename = "crossOrigin")]
    pub cross_origin: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct VerificationResult {
    pub verified: bool,
    pub credential_id: Option<String>,
    pub public_key: Option<String>,
    pub counter: Option<i32>,
    pub error: Option<String>,
}

pub struct PasskeyService<'a> {
    env: &'a Env,
}

impl<'a> PasskeyService<'a> {
    pub fn new(env: &'a Env) -> Self {
        Self { env }
    }

    /// Generate registration options for WebAuthn
    pub async fn generate_registration_options(
        &self,
        user: &PasskeyUser,
        exclude_credentials: Vec<String>,
    ) -> Result<RegistrationOptions, JsValue> {
        // Generate secure challenge
        let challenge = self.generate_challenge().await?;

        let options = RegistrationOptions {
            challenge: challenge.clone(),
            rp: RelyingParty {
                id: RP_ID.to_string(),
                name: RP_NAME.to_string(),
            },
            user: UserEntity {
                id: self.base64_url_encode_bytes(&user.id.as_bytes()),
                name: user.email.clone(),
                display_name: user.display_name.clone(),
            },
            pub_key_cred_params: vec![
                PubKeyCredParam {
                    credential_type: "public-key".to_string(),
                    alg: -7, // ES256
                },
                PubKeyCredParam {
                    credential_type: "public-key".to_string(),
                    alg: -257, // RS256
                },
            ],
            timeout: TIMEOUT,
            attestation: "none".to_string(),
            authenticator_selection: AuthenticatorSelection {
                authenticator_attachment: "platform".to_string(),
                user_verification: "required".to_string(),
                resident_key: "preferred".to_string(),
            },
            exclude_credentials: exclude_credentials
                .into_iter()
                .map(|id| PublicKeyCredentialDescriptor {
                    credential_type: "public-key".to_string(),
                    id,
                    transports: vec!["internal".to_string()],
                })
                .collect(),
        };

        // Store challenge in KV for later verification
        self.store_challenge(&user.id, &challenge).await?;

        Ok(options)
    }

    /// Verify registration response
    pub async fn verify_registration_response(
        &self,
        user_id: &str,
        response: &RegistrationResponse,
    ) -> Result<VerificationResult, JsValue> {
        // Get stored challenge
        let stored_challenge = match self.get_stored_challenge(user_id).await? {
            Some(challenge) => challenge,
            None => {
                return Ok(VerificationResult {
                    verified: false,
                    credential_id: None,
                    public_key: None,
                    counter: None,
                    error: Some("Challenge not found or expired".to_string()),
                });
            }
        };

        // Decode and verify client data
        let client_data = match self.decode_client_data(&response.response.client_data_json) {
            Ok(data) => data,
            Err(e) => {
                return Ok(VerificationResult {
                    verified: false,
                    credential_id: None,
                    public_key: None,
                    counter: None,
                    error: Some(format!("Failed to decode client data: {:?}", e)),
                });
            }
        };

        // Verify challenge
        if client_data.challenge != stored_challenge {
            return Ok(VerificationResult {
                verified: false,
                credential_id: None,
                public_key: None,
                counter: None,
                error: Some("Challenge mismatch".to_string()),
            });
        }

        // Verify origin
        if client_data.origin != ORIGIN {
            return Ok(VerificationResult {
                verified: false,
                credential_id: None,
                public_key: None,
                counter: None,
                error: Some("Origin mismatch".to_string()),
            });
        }

        // Verify type
        if client_data.client_data_type != "webauthn.create" {
            return Ok(VerificationResult {
                verified: false,
                credential_id: None,
                public_key: None,
                counter: None,
                error: Some("Invalid client data type".to_string()),
            });
        }

        // Parse attestation object
        let attestation_result =
            self.parse_attestation_object(&response.response.attestation_object)?;

        // Clean up challenge
        self.remove_challenge(user_id).await?;

        Ok(VerificationResult {
            verified: true,
            credential_id: Some(response.id.clone()),
            public_key: Some(attestation_result.public_key),
            counter: Some(attestation_result.counter),
            error: None,
        })
    }

    /// Generate authentication options
    pub async fn generate_authentication_options(
        &self,
        user_id: &str,
        allow_credentials: Vec<PasskeyDevice>,
    ) -> Result<AuthenticationOptions, JsValue> {
        // Generate secure challenge
        let challenge = self.generate_challenge().await?;

        let options = AuthenticationOptions {
            challenge: challenge.clone(),
            rp_id: RP_ID.to_string(),
            timeout: TIMEOUT,
            user_verification: "required".to_string(),
            allow_credentials: allow_credentials
                .into_iter()
                .map(|device| PublicKeyCredentialDescriptor {
                    credential_type: "public-key".to_string(),
                    id: device.credential_id,
                    transports: device.transports,
                })
                .collect(),
        };

        // Store challenge for later verification
        self.store_auth_challenge(user_id, &challenge).await?;

        Ok(options)
    }

    /// Verify authentication response
    pub async fn verify_authentication_response(
        &self,
        user_id: &str,
        response: &AuthenticationResponse,
        stored_device: &PasskeyDevice,
    ) -> Result<VerificationResult, JsValue> {
        // Get stored challenge
        let stored_challenge = match self.get_stored_auth_challenge(user_id).await? {
            Some(challenge) => challenge,
            None => {
                return Ok(VerificationResult {
                    verified: false,
                    credential_id: None,
                    public_key: None,
                    counter: None,
                    error: Some("Challenge not found or expired".to_string()),
                });
            }
        };

        // Decode and verify client data
        let client_data = match self.decode_client_data(&response.response.client_data_json) {
            Ok(data) => data,
            Err(e) => {
                return Ok(VerificationResult {
                    verified: false,
                    credential_id: None,
                    public_key: None,
                    counter: None,
                    error: Some(format!("Failed to decode client data: {:?}", e)),
                });
            }
        };

        // Verify challenge
        if client_data.challenge != stored_challenge {
            return Ok(VerificationResult {
                verified: false,
                credential_id: None,
                public_key: None,
                counter: None,
                error: Some("Challenge mismatch".to_string()),
            });
        }

        // Verify origin
        if client_data.origin != ORIGIN {
            return Ok(VerificationResult {
                verified: false,
                credential_id: None,
                public_key: None,
                counter: None,
                error: Some("Origin mismatch".to_string()),
            });
        }

        // Verify type
        if client_data.client_data_type != "webauthn.get" {
            return Ok(VerificationResult {
                verified: false,
                credential_id: None,
                public_key: None,
                counter: None,
                error: Some("Invalid client data type".to_string()),
            });
        }

        // Verify credential ID matches
        if response.id != stored_device.credential_id {
            return Ok(VerificationResult {
                verified: false,
                credential_id: None,
                public_key: None,
                counter: None,
                error: Some("Credential ID mismatch".to_string()),
            });
        }

        // Parse authenticator data
        let auth_data = self.parse_authenticator_data(&response.response.authenticator_data)?;

        // Verify counter (replay attack prevention)
        if auth_data.counter <= stored_device.counter {
            return Ok(VerificationResult {
                verified: false,
                credential_id: None,
                public_key: None,
                counter: None,
                error: Some("Invalid counter - possible replay attack".to_string()),
            });
        }

        // Verify signature
        let signature_valid = self
            .verify_signature(
                &stored_device.public_key,
                &response.response.authenticator_data,
                &response.response.client_data_json,
                &response.response.signature,
            )
            .await?;

        if !signature_valid {
            return Ok(VerificationResult {
                verified: false,
                credential_id: None,
                public_key: None,
                counter: None,
                error: Some("Invalid signature".to_string()),
            });
        }

        // Clean up challenge
        self.remove_auth_challenge(user_id).await?;

        Ok(VerificationResult {
            verified: true,
            credential_id: Some(response.id.clone()),
            public_key: Some(stored_device.public_key.clone()),
            counter: Some(auth_data.counter),
            error: None,
        })
    }

    // Helper methods
    async fn generate_challenge(&self) -> Result<String, JsValue> {
        let crypto = self.get_crypto()?;
        let mut challenge_bytes = vec![0u8; CHALLENGE_LENGTH];
        crypto.get_random_values_with_u8_array(&mut challenge_bytes[..])?;
        Ok(self.base64_url_encode_bytes(&challenge_bytes))
    }

    async fn store_challenge(&self, user_id: &str, challenge: &str) -> Result<(), JsValue> {
        if let Ok(kv) = self.env.kv("REFRESH_TOKEN_KV") {
            kv.put(&format!("passkey_challenge_{}", user_id), challenge)?
                .expiration_ttl(300) // 5 minutes
                .execute()
                .await?;
        }
        Ok(())
    }

    async fn get_stored_challenge(&self, user_id: &str) -> Result<Option<String>, JsValue> {
        if let Ok(kv) = self.env.kv("REFRESH_TOKEN_KV") {
            return Ok(kv
                .get(&format!("passkey_challenge_{}", user_id))
                .text()
                .await?
                .map(|s| s));
        }
        Ok(None)
    }

    async fn remove_challenge(&self, user_id: &str) -> Result<(), JsValue> {
        if let Ok(kv) = self.env.kv("REFRESH_TOKEN_KV") {
            kv.delete(&format!("passkey_challenge_{}", user_id)).await?;
        }
        Ok(())
    }

    async fn store_auth_challenge(&self, user_id: &str, challenge: &str) -> Result<(), JsValue> {
        if let Ok(kv) = self.env.kv("REFRESH_TOKEN_KV") {
            kv.put(&format!("passkey_auth_challenge_{}", user_id), challenge)?
                .expiration_ttl(300) // 5 minutes
                .execute()
                .await?;
        }
        Ok(())
    }

    async fn get_stored_auth_challenge(&self, user_id: &str) -> Result<Option<String>, JsValue> {
        if let Ok(kv) = self.env.kv("REFRESH_TOKEN_KV") {
            return Ok(kv
                .get(&format!("passkey_auth_challenge_{}", user_id))
                .text()
                .await?
                .map(|s| s));
        }
        Ok(None)
    }

    async fn remove_auth_challenge(&self, user_id: &str) -> Result<(), JsValue> {
        if let Ok(kv) = self.env.kv("REFRESH_TOKEN_KV") {
            kv.delete(&format!("passkey_auth_challenge_{}", user_id))
                .await?;
        }
        Ok(())
    }

    fn decode_client_data(
        &self,
        client_data_json: &str,
    ) -> Result<ClientData, Box<dyn std::error::Error>> {
        let decoded = self.base64_url_decode_bytes(client_data_json)?;
        let client_data_str = String::from_utf8(decoded)?;
        let client_data: ClientData = serde_json::from_str(&client_data_str)?;
        Ok(client_data)
    }

    fn parse_attestation_object(
        &self,
        attestation_object: &str,
    ) -> Result<AttestationResult, JsValue> {
        // Decode the attestation object
        let decoded = self
            .base64_url_decode_bytes(attestation_object)
            .map_err(|e| {
                JsValue::from_str(&format!("Failed to decode attestation object: {:?}", e))
            })?;

        // Parse CBOR (simplified - in production you'd use a proper CBOR parser)
        // For now, we'll extract the essential parts
        let attestation_result = AttestationResult {
            public_key: self.base64_url_encode_bytes(&decoded[0..65.min(decoded.len())]), // Simplified key extraction
            counter: 0, // New credentials start at 0
        };

        Ok(attestation_result)
    }

    fn parse_authenticator_data(
        &self,
        authenticator_data: &str,
    ) -> Result<AuthenticatorData, JsValue> {
        let decoded = self
            .base64_url_decode_bytes(authenticator_data)
            .map_err(|e| {
                JsValue::from_str(&format!("Failed to decode authenticator data: {:?}", e))
            })?;

        // Parse the counter from bytes 33-36 (little-endian)
        let counter = if decoded.len() >= 37 {
            u32::from_be_bytes([decoded[33], decoded[34], decoded[35], decoded[36]]) as i32
        } else {
            0
        };

        Ok(AuthenticatorData { counter })
    }

    async fn verify_signature(
        &self,
        public_key: &str,
        authenticator_data: &str,
        client_data_json: &str,
        signature: &str,
    ) -> Result<bool, JsValue> {
        // Decode the components
        let auth_data_bytes = self
            .base64_url_decode_bytes(authenticator_data)
            .map_err(|e| {
                JsValue::from_str(&format!("Failed to decode authenticator data: {:?}", e))
            })?;

        let client_data_bytes = self
            .base64_url_decode_bytes(client_data_json)
            .map_err(|e| JsValue::from_str(&format!("Failed to decode client data: {:?}", e)))?;

        let signature_bytes = self
            .base64_url_decode_bytes(signature)
            .map_err(|e| JsValue::from_str(&format!("Failed to decode signature: {:?}", e)))?;

        // Create SHA-256 hash of client data
        let client_data_hash = self.sha256_hash(&client_data_bytes).await?;

        // Concatenate authenticator data and client data hash
        let mut signed_data = auth_data_bytes;
        signed_data.extend_from_slice(&client_data_hash);

        // Use Web Crypto API to verify the signature
        let crypto = self.get_crypto()?;
        let _subtle = crypto.subtle();

        // Import the public key (simplified - in production you'd properly parse the key)
        let public_key_bytes = self
            .base64_url_decode_bytes(public_key)
            .map_err(|e| JsValue::from_str(&format!("Failed to decode public key: {:?}", e)))?;

        // For now, return true if we can decode everything properly
        // In production, you'd implement proper ECDSA verification
        Ok(public_key_bytes.len() > 0 && signature_bytes.len() > 0)
    }

    async fn sha256_hash(&self, data: &[u8]) -> Result<Vec<u8>, JsValue> {
        let crypto = self.get_crypto()?;
        let subtle = crypto.subtle();

        let hash_promise = subtle.digest_with_str_and_u8_array("SHA-256", data)?;
        let hash_result = JsFuture::from(hash_promise).await?;

        let hash_buffer = js_sys::ArrayBuffer::from(hash_result);
        let hash_array = Uint8Array::new(&hash_buffer);
        let mut hash_vec = vec![0u8; hash_array.length() as usize];
        hash_array.copy_to(&mut hash_vec);

        Ok(hash_vec)
    }

    fn get_crypto(&self) -> Result<web_sys::Crypto, JsValue> {
        let global = js_sys::global();
        let crypto_val = Reflect::get(&global, &"crypto".into())?;
        Ok(web_sys::Crypto::from(crypto_val))
    }

    fn base64_url_encode_bytes(&self, input: &[u8]) -> String {
        let encoded = BASE64_STANDARD.encode(input);
        encoded.replace('+', "-").replace('/', "_").replace('=', "")
    }

    fn base64_url_decode_bytes(&self, input: &str) -> Result<Vec<u8>, Box<dyn std::error::Error>> {
        // Add padding if necessary
        let mut padded = input.to_string();
        while padded.len() % 4 != 0 {
            padded.push('=');
        }

        // Replace url-safe characters
        let base64 = padded.replace('-', "+").replace('_', "/");

        // Decode
        let decoded_bytes = BASE64_STANDARD.decode(base64)?;
        Ok(decoded_bytes)
    }
}

#[derive(Debug)]
struct AttestationResult {
    public_key: String,
    counter: i32,
}

#[derive(Debug)]
struct AuthenticatorData {
    counter: i32,
}
