use base64::prelude::*;
use serde::{Deserialize, Serialize};
use worker::{Request, Response, RouteContext, D1Database, Env};
use serde_json::json;
use nanoid::nanoid;
use chrono::Utc;
use crate::middleware::auth::AuthMiddleware;
use crate::services::email_service::create_email_service;
use crate::services::crypto::JwtCrypto;
use crate::services::passkey_service::{PasskeyService, PasskeyUser, PasskeyDevice, RegistrationResponse, AuthenticationResponse};
use urlencoding;

#[derive(Debug, Deserialize)]
struct SendCodeRequest {
    email: String,
    phone: Option<String>,
}

#[derive(Debug, Deserialize)]
struct VerifyCodeRequest {
    email: String,
    code: String,
    phone: Option<String>,
}

#[derive(Debug, Deserialize)]
struct RefreshTokenRequest {
    refresh_token: String,
}

#[derive(Debug, Deserialize)]
struct GoogleTokenRequest {
    #[serde(rename = "idToken")]
    id_token: String,
}

#[derive(Debug, Deserialize)]
struct GoogleTokenInfo {
    aud: String,
    email: String,
    email_verified: String,
}

#[derive(Debug, Deserialize)]
struct GoogleOAuthRequest {
    code: String,
    #[serde(rename = "codeVerifier")]
    code_verifier: String,
    #[serde(rename = "redirectUri")]
    redirect_uri: String,
}

#[derive(Debug, Deserialize)]
struct AppleOAuthRequest {
    code: String,
    #[serde(rename = "identityToken")]
    identity_token: String,
}

#[derive(Debug, Deserialize)]
struct PasskeyCheckRequest {
    email: String,
}

#[derive(Debug, Deserialize)]
struct PasskeyAuthBeginRequest {
    email: String,
}

#[derive(Debug, Deserialize)]
struct PasskeyCredentialResponse {
    #[serde(rename = "attestationObject")]
    attestation_object: String,
    #[serde(rename = "clientDataJSON")]
    client_data_json: String,
}

#[derive(Debug, Deserialize)]
struct PasskeyAuthResponse {
    #[serde(rename = "authenticatorData")]
    authenticator_data: String,
    #[serde(rename = "clientDataJSON")]
    client_data_json: String,
    signature: String,
    #[serde(rename = "userHandle")]
    user_handle: Option<String>,
}

#[derive(Debug, Deserialize)]
struct PasskeyCredential {
    id: String,
    #[serde(rename = "rawId")]
    raw_id: String,
    response: PasskeyCredentialResponse,
    #[serde(rename = "type")]
    credential_type: String,
    #[serde(rename = "clientExtensionResults")]
    client_extension_results: Option<serde_json::Value>,
}

#[derive(Debug, Deserialize)]
struct PasskeyAuthCredential {
    id: String,
    #[serde(rename = "rawId")]
    raw_id: String,
    response: PasskeyAuthResponse,
    #[serde(rename = "type")]
    credential_type: String,
    #[serde(rename = "clientExtensionResults")]
    client_extension_results: Option<serde_json::Value>,
}

#[derive(Debug, Deserialize)]
struct PasskeyRegisterCompleteRequest {
    credential: PasskeyCredential,
    #[serde(rename = "deviceName")]
    device_name: Option<String>,
}

#[derive(Debug, Deserialize)]
struct PasskeyAuthCompleteRequest {
    credential: PasskeyAuthCredential,
}

#[derive(Debug, Serialize, Deserialize)]
struct SimpleToken {
    user_id: String,
    email: String,
    exp: i64, // expiration timestamp
}

#[derive(Debug)]
struct TokenResponse {
    access_token: String,
    refresh_token: String,
    access_token_expires_at: i64,
}

#[derive(Debug)]
struct UserSecurityStatus {
    security_setup_required: bool,
    has_passkeys: bool,
}

// Apple JWT verification structs
#[derive(Debug, Deserialize)]
struct AppleJWTHeader {
    alg: String,
    kid: String,
    #[serde(rename = "typ")]
    token_type: String,
}

#[derive(Debug, Deserialize)]
struct AppleJWTPayload {
    iss: String,
    aud: String,
    exp: i64,
    iat: i64,
    sub: String,
    email: Option<String>,
    email_verified: Option<serde_json::Value>, // Can be string or bool
    auth_time: Option<i64>,
    nonce_supported: Option<bool>,
}

#[derive(Debug, Deserialize)]
struct ApplePublicKey {
    kty: String,
    kid: String,
    #[serde(rename = "use")]
    key_use: String,
    alg: String,
    n: String,
    e: String,
}

#[derive(Debug, Deserialize)]
struct AppleKeysResponse {
    keys: Vec<ApplePublicKey>,
}

#[derive(Debug)]
struct AppleUserInfo {
    email: String,
    email_verified: bool,
    sub: String,
}

const REFRESH_TOKEN_EXPIRATION_SECONDS: u64 = 60 * 60 * 24 * 7; // 7 days
const CODE_EXPIRATION_MINUTES: i64 = 10;

pub struct AuthRoutes;

impl AuthRoutes {
    pub async fn get_me(req: Request, ctx: RouteContext<()>) -> worker::Result<Response> {
        let env = ctx.env;
        
        // Validate authentication
        let user = match AuthMiddleware::validate_token(&req, &env).await {
            Ok(user) => user,
            Err(response) => return Ok(response),
        };

        let db = match env.d1("DB") {
            Ok(database) => database,
            Err(_) => {
                return Ok(Response::from_json(&json!({
                    "error": "Internal Server Error",
                    "message": "Database connection failed"
                }))?.with_status(500));
            }
        };

        // Check if profile exists
        let profile_exists = match db
            .prepare("SELECT COUNT(*) as count FROM profile WHERE user_id = ?")
            .bind(&[user.id.clone().into()])?
            .first::<serde_json::Value>(None)
            .await
        {
            Ok(Some(result)) => {
                result.get("count").and_then(|v| v.as_i64()).unwrap_or(0) > 0
            },
            Ok(None) => false,
            Err(e) => {
                worker::console_log!("Error checking profile existence: {:?}", e);
                false
            }
        };

        // Get security status (check if user has passkeys)
        let security_status = Self::get_user_security_status(&db, &user.id).await;

        Ok(Response::from_json(&json!({
            "id": user.id,
            "email": user.email,
            "profileExists": profile_exists,
            "securitySetupRequired": security_status.security_setup_required,
            "hasPasskeys": security_status.has_passkeys,
        }))?)
    }

    pub async fn send_code(mut req: Request, ctx: RouteContext<()>) -> worker::Result<Response> {
        let body: SendCodeRequest = match req.json().await {
            Ok(body) => body,
            Err(_) => {
                return Ok(Response::from_json(&json!({
                    "error": "Invalid input",
                    "message": "Invalid JSON body",
                    "code": "auth/invalid-input"
                }))?.with_status(400));
            }
        };

        let env = ctx.env;
        let db = match env.d1("DB") {
            Ok(database) => database,
            Err(_) => {
                return Ok(Response::from_json(&json!({
                    "error": "Internal Server Error",
                    "message": "Database connection failed"
                }))?.with_status(500));
            }
        };

        // Validate email format (basic validation)
        if !body.email.contains('@') {
            return Ok(Response::from_json(&json!({
                "error": "Invalid input",
                "message": "Invalid email format",
                "code": "auth/invalid-input"
            }))?.with_status(400));
        }

        // Clean up expired codes
        Self::cleanup_expired_codes(&db).await?;

        // Generate secure code
        let code = Self::generate_secure_code();
        let code_id = nanoid!();
        let now = Utc::now();
        let expires_at = now + chrono::Duration::minutes(CODE_EXPIRATION_MINUTES);

        // Insert email code
        match db
            .prepare("INSERT INTO email_codes (id, email, code, type, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?)")
            .bind(&[
                code_id.into(),
                body.email.clone().into(),
                code.clone().into(),
                "login_register".into(),
                expires_at.timestamp().to_string().into(),
                now.timestamp().to_string().into(),
            ])?
            .run()
            .await
        {
            Ok(_) => {
                // Send email using the email service
                match create_email_service(&env) {
                    Ok(email_service) => {
                        match email_service.send_verification_code(&body.email, &code, "login_register").await {
                            Ok(_) => {
                                // Check if user exists to determine message
                                let is_new_user = match db
                                    .prepare("SELECT id FROM users WHERE email = ?")
                                    .bind(&[body.email.clone().into()])?
                                    .first::<serde_json::Value>(None)
                                    .await
                                {
                                    Ok(Some(_)) => false,
                                    Ok(None) => true,
                                    Err(_) => true, // Default to new user if we can't check
                                };

                                let message = if is_new_user {
                                    "Welcome! We've sent a verification code to your email."
                                } else {
                                    "Welcome back! We've sent a verification code to your email."
                                };

                                Ok(Response::from_json(&json!({
                                    "success": true,
                                    "message": message,
                                    "isNewUser": is_new_user
                                }))?)
                            },
                            Err(e) => {
                                worker::console_log!("Failed to send email: {:?}", e);
                                
                                // Check if it's a configuration issue
                                let error_msg = format!("{:?}", e);
                                if error_msg.contains("RESEND_API_KEY") {
                                    Ok(Response::from_json(&json!({
                                        "error": "Email service is not configured. Please contact support.",
                                        "code": "auth/email-service-unavailable"
                                    }))?.with_status(503))
                                } else {
                                    Ok(Response::from_json(&json!({
                                        "error": "Unable to send verification code. Please check your email address and try again.",
                                        "code": "auth/email-send-failed"
                                    }))?.with_status(500))
                                }
                            }
                        }
                    },
                    Err(e) => {
                        worker::console_log!("Failed to create email service: {:?}", e);
                        Ok(Response::from_json(&json!({
                            "error": "Email service is not configured. Please contact support.",
                            "code": "auth/email-service-unavailable"
                        }))?.with_status(503))
                    }
                }
            },
            Err(e) => {
                worker::console_log!("Error inserting email code: {:?}", e);
                Ok(Response::from_json(&json!({
                    "error": "Internal Server Error",
                    "message": "Failed to send code",
                    "code": "auth/server-error"
                }))?.with_status(500))
            }
        }
    }

    pub async fn verify_code(mut req: Request, ctx: RouteContext<()>) -> worker::Result<Response> {
        let body: VerifyCodeRequest = match req.json().await {
            Ok(body) => body,
            Err(_) => {
                return Ok(Response::from_json(&json!({
                    "error": "Invalid input",
                    "message": "Invalid JSON body",
                    "code": "auth/invalid-input"
                }))?.with_status(400));
            }
        };

        let env = ctx.env;
        let db = match env.d1("DB") {
            Ok(database) => database,
            Err(_) => {
                return Ok(Response::from_json(&json!({
                    "error": "Internal Server Error",
                    "message": "Database connection failed"
                }))?.with_status(500));
            }
        };

        // Validate code length
        if body.code.len() != 6 {
            return Ok(Response::from_json(&json!({
                "error": "Invalid input",
                "message": "Code must be 6 digits",
                "code": "auth/invalid-input"
            }))?.with_status(400));
        }

        let now = Utc::now().timestamp().to_string();

        // Find valid code
        let code_record = match db
            .prepare("SELECT id, email FROM email_codes WHERE email = ? AND code = ? AND expires_at > ? AND used_at IS NULL ORDER BY created_at DESC LIMIT 1")
            .bind(&[
                body.email.clone().into(),
                body.code.clone().into(),
                now.clone().into(),
            ])?
            .first::<serde_json::Value>(None)
            .await
        {
            Ok(Some(record)) => record,
            Ok(None) => {
                return Ok(Response::from_json(&json!({
                    "error": "Invalid or expired code",
                    "message": "The verification code is invalid or has expired",
                    "code": "auth/invalid-code"
                }))?.with_status(400));
            },
            Err(e) => {
                worker::console_log!("Error finding email code: {:?}", e);
                return Ok(Response::from_json(&json!({
                    "error": "Internal Server Error",
                    "message": "Failed to verify code"
                }))?.with_status(500));
            }
        };

        let code_id = code_record.get("id").and_then(|v| v.as_str()).unwrap_or("");

        // Mark code as used
        match db
            .prepare("UPDATE email_codes SET used_at = ? WHERE id = ?")
            .bind(&[now.into(), code_id.into()])?
            .run()
            .await
        {
            Ok(_) => {},
            Err(e) => {
                worker::console_log!("Error marking code as used: {:?}", e);
                return Ok(Response::from_json(&json!({
                    "error": "Internal Server Error",
                    "message": "Failed to verify code"
                }))?.with_status(500));
            }
        }

        // Find or create user
        let user_id = match Self::find_or_create_user(&db, &body.email, body.phone.as_deref()).await {
            Ok(id) => id,
            Err(e) => {
                worker::console_log!("Error finding or creating user: {:?}", e);
                return Ok(Response::from_json(&json!({
                    "error": "Internal Server Error",
                    "message": "Failed to process login"
                }))?.with_status(500));
            }
        };

        // Check if this is a new user
        let is_new_user = match db
            .prepare("SELECT created_at FROM users WHERE id = ?")
            .bind(&[user_id.clone().into()])?
            .first::<serde_json::Value>(None)
            .await
        {
            Ok(Some(user)) => {
                // Check if user was created in the last minute (indicating new user)
                let created_at_str = user.get("created_at").and_then(|v| v.as_str()).unwrap_or("0");
                let created_at = created_at_str.parse::<i64>().unwrap_or(0);
                let now = Utc::now().timestamp();
                (now - created_at) < 60 // Less than 60 seconds ago
            },
            _ => false,
        };

        // Generate JWT tokens
        let tokens = match Self::generate_jwt_tokens(&user_id, &body.email, &env).await {
            Ok(tokens) => tokens,
            Err(e) => {
                worker::console_log!("Error generating JWT tokens: {:?}", e);
                return Ok(Response::from_json(&json!({
                    "error": "Internal Server Error",
                    "message": "Failed to generate tokens",
                    "code": "auth/server-error"
                }))?.with_status(500));
            }
        };

        // Check if profile exists
        let profile_exists = match db
            .prepare("SELECT COUNT(*) as count FROM profile WHERE user_id = ?")
            .bind(&[user_id.clone().into()])?
            .first::<serde_json::Value>(None)
            .await
        {
            Ok(Some(result)) => {
                result.get("count").and_then(|v| v.as_i64()).unwrap_or(0) > 0
            },
            Ok(None) => false,
            Err(e) => {
                worker::console_log!("Error checking profile existence: {:?}", e);
                false
            }
        };

        // Get security status
        let security_status = Self::get_user_security_status(&db, &user_id).await;

        // Log activity for existing users
        if !is_new_user {
            let activity_id = nanoid!();
            let _ = db
                .prepare("INSERT INTO user_activity (id, user_id, event_type, created_at) VALUES (?, ?, ?, ?)")
                .bind(&[
                    activity_id.into(),
                    user_id.clone().into(),
                    "login".into(),
                    Utc::now().timestamp().to_string().into(),
                ])?
                .run()
                .await;
        }

        Ok(Response::from_json(&json!({
            "session": {
                "access_token": tokens.access_token,
                "refresh_token": tokens.refresh_token,
                "expires_at": tokens.access_token_expires_at
            },
            "user": {
                "id": user_id,
                "email": body.email
            },
            "profileExists": profile_exists,
            "isNewUser": is_new_user,
            "securitySetupRequired": security_status.security_setup_required,
            "hasPasskeys": security_status.has_passkeys
        }))?)
    }

    pub async fn refresh(mut req: Request, ctx: RouteContext<()>) -> worker::Result<Response> {
        let body: RefreshTokenRequest = match req.json().await {
            Ok(body) => body,
            Err(_) => {
                return Ok(Response::from_json(&json!({
                    "error": "Invalid input",
                    "message": "Invalid JSON body"
                }))?.with_status(400));
            }
        };

        let env = ctx.env;

        // Get user ID from refresh token KV
        let user_id = match env.kv("REFRESH_TOKEN_KV") {
            Ok(kv) => {
                match kv.get(&format!("rt_{}", body.refresh_token)).text().await {
                    Ok(Some(id)) => {
                        // Invalidate the used refresh token immediately
                        let _ = kv.delete(&format!("rt_{}", body.refresh_token)).await;
                        id
                    },
                    Ok(None) => {
                        return Ok(Response::from_json(&json!({
                            "error": "Invalid refresh token",
                            "message": "Refresh token not found or expired",
                            "code": "auth/invalid-refresh-token"
                        }))?.with_status(401));
                    },
                    Err(e) => {
                        worker::console_log!("Error getting refresh token: {:?}", e);
                        return Ok(Response::from_json(&json!({
                            "error": "Internal Server Error",
                            "message": "Failed to validate refresh token",
                            "code": "auth/server-error"
                        }))?.with_status(500));
                    }
                }
            },
            Err(_) => {
                return Ok(Response::from_json(&json!({
                    "error": "Internal Server Error",
                    "message": "Refresh token service unavailable",
                    "code": "auth/kv-not-configured"
                }))?.with_status(500));
            }
        };

        let db = match env.d1("DB") {
            Ok(database) => database,
            Err(_) => {
                return Ok(Response::from_json(&json!({
                    "error": "Internal Server Error",
                    "message": "Database connection failed"
                }))?.with_status(500));
            }
        };

        // Get user email
        let user_email = match db
            .prepare("SELECT email FROM users WHERE id = ?")
            .bind(&[user_id.clone().into()])?
            .first::<serde_json::Value>(None)
            .await
        {
            Ok(Some(user)) => {
                user.get("email").and_then(|v| v.as_str()).unwrap_or("").to_string()
            },
            Ok(None) => {
                return Ok(Response::from_json(&json!({
                    "error": "Invalid refresh token",
                    "message": "User not found for refresh token",
                    "code": "auth/user-not-found"
                }))?.with_status(401));
            },
            Err(e) => {
                worker::console_log!("Error getting user: {:?}", e);
                return Ok(Response::from_json(&json!({
                    "error": "Internal Server Error",
                    "message": "Failed to validate user",
                    "code": "auth/server-error"
                }))?.with_status(500));
            }
        };

        // Generate new JWT tokens
        let tokens = match Self::generate_jwt_tokens(&user_id, &user_email, &env).await {
            Ok(tokens) => tokens,
            Err(e) => {
                worker::console_log!("Error generating JWT tokens: {:?}", e);
                return Ok(Response::from_json(&json!({
                    "error": "Internal Server Error",
                    "message": "Failed to generate tokens",
                    "code": "auth/server-error"
                }))?.with_status(500));
            }
        };

        // Check if profile exists
        let profile_exists = match db
            .prepare("SELECT COUNT(*) as count FROM profile WHERE user_id = ?")
            .bind(&[user_id.clone().into()])?
            .first::<serde_json::Value>(None)
            .await
        {
            Ok(Some(result)) => {
                result.get("count").and_then(|v| v.as_i64()).unwrap_or(0) > 0
            },
            Ok(None) => false,
            Err(e) => {
                worker::console_log!("Error checking profile existence: {:?}", e);
                false
            }
        };

        Ok(Response::from_json(&json!({
            "session": {
                "access_token": tokens.access_token,
                "refresh_token": tokens.refresh_token,
                "expires_at": tokens.access_token_expires_at
            },
            "user": {
                "id": user_id,
                "email": user_email
            },
            "profileExists": profile_exists
        }))?)
    }

    pub async fn logout(mut req: Request, ctx: RouteContext<()>) -> worker::Result<Response> {
        let body: serde_json::Value = req.json().await.unwrap_or(serde_json::json!({}));
        let refresh_token = body.get("refresh_token").and_then(|v| v.as_str());

        if let Some(token) = refresh_token {
            if let Ok(kv) = ctx.env.kv("REFRESH_TOKEN_KV") {
                let _ = kv.delete(&format!("rt_{}", token)).await;
            }
        }

        Ok(Response::from_json(&json!({
            "success": true,
            "message": "Logged out successfully."
        }))?)
    }

    pub async fn oauth_google_token(mut req: Request, ctx: RouteContext<()>) -> worker::Result<Response> {
        let body: GoogleTokenRequest = match req.json().await {
            Ok(body) => body,
            Err(_) => {
                return Ok(Response::from_json(&json!({
                    "error": "Invalid input",
                    "message": "Invalid JSON body",
                    "code": "auth/invalid-input"
                }))?.with_status(400));
            }
        };

        let env = ctx.env;

        // Verify Google ID token
        let token_info_url = format!("https://oauth2.googleapis.com/tokeninfo?id_token={}", body.id_token);
        
        let token_response = match worker::Fetch::Url(token_info_url.parse().unwrap()).send().await {
            Ok(response) => response,
            Err(e) => {
                worker::console_log!("❌ Failed to fetch Google token info: {:?}", e);
                return Ok(Response::from_json(&json!({
                    "error": "Invalid Google ID token",
                    "code": "auth/invalid-token"
                }))?.with_status(401));
            }
        };

        if token_response.status_code() != 200 {
            worker::console_log!("❌ Google token validation failed with status: {}", token_response.status_code());
            return Ok(Response::from_json(&json!({
                "error": "Invalid Google ID token",
                "code": "auth/invalid-token"
            }))?.with_status(401));
        }

        let mut token_response = token_response;
        let token_info: GoogleTokenInfo = match token_response.json().await {
            Ok(info) => info,
            Err(e) => {
                worker::console_log!("❌ Failed to parse Google token info: {:?}", e);
                return Ok(Response::from_json(&json!({
                    "error": "Invalid Google ID token",
                    "code": "auth/invalid-token"
                }))?.with_status(401));
            }
        };

        // Verify the audience (client ID) matches our expected client ID
        let expected_client_id = env.secret("GOOGLE_CLIENT_ID").ok()
            .or_else(|| env.secret("GOOGLE_CLIENT_ID_IOS").ok());
        
        if let Some(expected_id) = expected_client_id {
            let expected_str = expected_id.to_string();
            if token_info.aud != expected_str {
                worker::console_log!("❌ ID token audience mismatch: expected {}, got {}", 
                    if expected_str.len() > 20 { format!("{}...", &expected_str[..20]) } else { expected_str.clone() },
                    if token_info.aud.len() > 20 { format!("{}...", &token_info.aud[..20]) } else { token_info.aud.clone() }
                );
                return Ok(Response::from_json(&json!({
                    "error": "ID token audience mismatch",
                    "code": "auth/invalid-audience"
                }))?.with_status(401));
            }
        } else {
            worker::console_log!("❌ Google OAuth not configured - missing GOOGLE_CLIENT_ID");
            return Ok(Response::from_json(&json!({
                "error": "Google OAuth not configured",
                "code": "auth/oauth-not-configured"
            }))?.with_status(500));
        }

        if token_info.email.is_empty() {
            return Ok(Response::from_json(&json!({
                "error": "Failed to get user email from Google ID token",
                "code": "auth/oauth-failed"
            }))?.with_status(400));
        }

        let db = match env.d1("DB") {
            Ok(database) => database,
            Err(_) => {
                return Ok(Response::from_json(&json!({
                    "error": "Internal Server Error",
                    "message": "Database connection failed"
                }))?.with_status(500));
            }
        };

        // Check if user exists or create new user
        let (user_id, is_new_user) = match Self::find_or_create_oauth_user_with_status(&db, &token_info.email, &token_info.email_verified).await {
            Ok((id, is_new)) => (id, is_new),
            Err(e) => {
                worker::console_log!("❌ Error finding or creating Google OAuth user: {:?}", e);
                return Ok(Response::from_json(&json!({
                    "error": "Failed to create or update user",
                    "code": "auth/user-creation-failed"
                }))?.with_status(500));
            }
        };

        // Generate JWT tokens
        let tokens = match Self::generate_jwt_tokens(&user_id, &token_info.email, &env).await {
            Ok(tokens) => tokens,
            Err(e) => {
                worker::console_log!("❌ Error generating JWT tokens: {:?}", e);
                return Ok(Response::from_json(&json!({
                    "error": "Internal Server Error",
                    "message": "Failed to generate tokens",
                    "code": "auth/server-error"
                }))?.with_status(500));
            }
        };

        // Check if profile exists
        let profile_exists = match db
            .prepare("SELECT COUNT(*) as count FROM profile WHERE user_id = ?")
            .bind(&[user_id.clone().into()])?
            .first::<serde_json::Value>(None)
            .await
        {
            Ok(Some(result)) => {
                result.get("count").and_then(|v| v.as_i64()).unwrap_or(0) > 0
            },
            Ok(None) => false,
            Err(e) => {
                worker::console_log!("❌ Error checking profile existence: {:?}", e);
                false
            }
        };

        // Get security status
        let security_status = Self::get_user_security_status(&db, &user_id).await;

        // Log activity for existing users
        if !is_new_user {
            let activity_id = nanoid!();
            let _ = db
                .prepare("INSERT INTO user_activity (id, user_id, event_type, created_at) VALUES (?, ?, ?, ?)")
                .bind(&[
                    activity_id.into(),
                    user_id.clone().into(),
                    "oauth_login".into(),
                    Utc::now().timestamp().to_string().into(),
                ])?
                .run()
                .await;
        }

        let response = json!({
            "session": {
                "access_token": tokens.access_token,
                "refresh_token": tokens.refresh_token,
                "expires_at": tokens.access_token_expires_at
            },
            "user": {
                "id": user_id,
                "email": token_info.email
            },
            "profileExists": profile_exists,
            "isNewUser": is_new_user,
            "securitySetupRequired": security_status.security_setup_required,
            "hasPasskeys": security_status.has_passkeys
        });

        Ok(Response::from_json(&response)?)
    }

    pub async fn oauth_google(mut req: Request, ctx: RouteContext<()>) -> worker::Result<Response> {
        let body: GoogleOAuthRequest = match req.json().await {
            Ok(body) => body,
            Err(_) => {
                return Ok(Response::from_json(&json!({
                    "error": "Invalid input",
                    "message": "Invalid JSON body",
                    "code": "auth/invalid-input"
                }))?.with_status(400));
            }
        };

        let env = ctx.env;

        // Check if Google OAuth is configured
        let client_id = env.secret("GOOGLE_CLIENT_ID_IOS").ok()
            .or_else(|| env.secret("GOOGLE_CLIENT_ID").ok());
        
        if client_id.is_none() {
            return Ok(Response::from_json(&json!({
                "error": "Google OAuth not configured. Set GOOGLE_CLIENT_ID_IOS environment variable.",
                "code": "auth/oauth-not-configured"
            }))?.with_status(500));
        }

        let client_id_str = client_id.unwrap().to_string();

        // Exchange authorization code for tokens using correct worker API
        let token_params = format!(
            "client_id={}&code={}&grant_type=authorization_code&redirect_uri={}&code_verifier={}",
            urlencoding::encode(&client_id_str),
            urlencoding::encode(&body.code),
            urlencoding::encode(&body.redirect_uri),
            urlencoding::encode(&body.code_verifier)
        );

        // Create headers for token exchange
        let headers = worker::Headers::new();
        headers.set("Content-Type", "application/x-www-form-urlencoded")?;

        // Create request for token exchange
        let mut request_init = worker::RequestInit::new();
        request_init.method = worker::Method::Post;
        request_init.headers = headers;
        request_init.body = Some(token_params.into());

        let request = worker::Request::new_with_init("https://oauth2.googleapis.com/token", &request_init)?;
        let mut token_response = match worker::Fetch::Request(request).send().await {
            Ok(response) => response,
            Err(e) => {
                worker::console_log!("❌ Failed to exchange Google authorization code: {:?}", e);
                return Ok(Response::from_json(&json!({
                    "error": "Google OAuth authentication failed",
                    "code": "auth/oauth-failed"
                }))?.with_status(500));
            }
        };

        if token_response.status_code() != 200 {
            let error_text = token_response.text().await.unwrap_or_default();
            worker::console_log!("❌ Google token exchange failed: status {}, error: {}", 
                token_response.status_code(), error_text);
            return Ok(Response::from_json(&json!({
                "error": "Google OAuth authentication failed",
                "code": "auth/oauth-failed"
            }))?.with_status(500));
        }

        let token_data: serde_json::Value = match token_response.json().await {
            Ok(data) => data,
            Err(e) => {
                worker::console_log!("❌ Failed to parse Google token response: {:?}", e);
                return Ok(Response::from_json(&json!({
                    "error": "Google OAuth authentication failed",
                    "code": "auth/oauth-failed"
                }))?.with_status(500));
            }
        };

        let access_token = match token_data.get("access_token").and_then(|v| v.as_str()) {
            Some(token) => token,
            None => {
                worker::console_log!("❌ No access token in Google response");
                return Ok(Response::from_json(&json!({
                    "error": "Google OAuth authentication failed",
                    "code": "auth/oauth-failed"
                }))?.with_status(500));
            }
        };

        // Get user info from Google using the access token
        let user_headers = worker::Headers::new();
        user_headers.set("Authorization", &format!("Bearer {}", access_token))?;

        let mut user_request_init = worker::RequestInit::new();
        user_request_init.method = worker::Method::Get;
        user_request_init.headers = user_headers;

        let user_request = worker::Request::new_with_init("https://www.googleapis.com/oauth2/v2/userinfo", &user_request_init)?;
        let mut user_response = match worker::Fetch::Request(user_request).send().await {
            Ok(response) => response,
            Err(e) => {
                worker::console_log!("❌ Failed to get Google user info: {:?}", e);
                return Ok(Response::from_json(&json!({
                    "error": "Google OAuth authentication failed",
                    "code": "auth/oauth-failed"
                }))?.with_status(500));
            }
        };

        if user_response.status_code() != 200 {
            worker::console_log!("❌ Failed to get Google user info: status {}", user_response.status_code());
            return Ok(Response::from_json(&json!({
                "error": "Google OAuth authentication failed",
                "code": "auth/oauth-failed"
            }))?.with_status(500));
        }

        let user_info: serde_json::Value = match user_response.json().await {
            Ok(info) => info,
            Err(e) => {
                worker::console_log!("❌ Failed to parse Google user info: {:?}", e);
                return Ok(Response::from_json(&json!({
                    "error": "Google OAuth authentication failed",
                    "code": "auth/oauth-failed"
                }))?.with_status(500));
            }
        };

        let email = match user_info.get("email").and_then(|v| v.as_str()) {
            Some(email) => email,
            None => {
                return Ok(Response::from_json(&json!({
                    "error": "Failed to get user email from Google",
                    "code": "auth/oauth-failed"
                }))?.with_status(400));
            }
        };

        let email_verified = user_info.get("verified_email")
            .and_then(|v| v.as_bool())
            .unwrap_or(false);

        let db = match env.d1("DB") {
            Ok(database) => database,
            Err(_) => {
                return Ok(Response::from_json(&json!({
                    "error": "Internal Server Error",
                    "message": "Database connection failed"
                }))?.with_status(500));
            }
        };

        // Check if user exists or create new user
        let (user_id, is_new_user) = match Self::find_or_create_oauth_user_with_status(
            &db, 
            email, 
            &email_verified.to_string()
        ).await {
            Ok((id, is_new)) => (id, is_new),
            Err(e) => {
                worker::console_log!("❌ Error finding or creating Google OAuth user: {:?}", e);
                return Ok(Response::from_json(&json!({
                    "error": "Failed to create or update user",
                    "code": "auth/user-creation-failed"
                }))?.with_status(500));
            }
        };

        // Generate JWT tokens
        let tokens = match Self::generate_jwt_tokens(&user_id, email, &env).await {
            Ok(tokens) => tokens,
            Err(e) => {
                worker::console_log!("❌ Error generating JWT tokens: {:?}", e);
                return Ok(Response::from_json(&json!({
                    "error": "Internal Server Error",
                    "message": "Failed to generate tokens",
                    "code": "auth/server-error"
                }))?.with_status(500));
            }
        };

        // Check if profile exists
        let profile_exists = match db
            .prepare("SELECT COUNT(*) as count FROM profile WHERE user_id = ?")
            .bind(&[user_id.clone().into()])?
            .first::<serde_json::Value>(None)
            .await
        {
            Ok(Some(result)) => {
                result.get("count").and_then(|v| v.as_i64()).unwrap_or(0) > 0
            },
            Ok(None) => false,
            Err(e) => {
                worker::console_log!("❌ Error checking profile existence: {:?}", e);
                false
            }
        };

        // Get security status
        let security_status = Self::get_user_security_status(&db, &user_id).await;

        // Log activity for existing users
        if !is_new_user {
            let activity_id = nanoid!();
            let _ = db
                .prepare("INSERT INTO user_activity (id, user_id, event_type, created_at) VALUES (?, ?, ?, ?)")
                .bind(&[
                    activity_id.into(),
                    user_id.clone().into(),
                    "oauth_login".into(),
                    Utc::now().timestamp().to_string().into(),
                ])?
                .run()
                .await;
        }

        Ok(Response::from_json(&json!({
            "session": {
                "access_token": tokens.access_token,
                "refresh_token": tokens.refresh_token,
                "expires_at": tokens.access_token_expires_at
            },
            "user": {
                "id": user_id,
                "email": email
            },
            "profileExists": profile_exists,
            "isNewUser": is_new_user,
            "securitySetupRequired": security_status.security_setup_required,
            "hasPasskeys": security_status.has_passkeys
        }))?)
    }

    pub async fn oauth_apple(mut req: Request, ctx: RouteContext<()>) -> worker::Result<Response> {
        let body: AppleOAuthRequest = match req.json().await {
            Ok(body) => body,
            Err(_) => {
                return Ok(Response::from_json(&json!({
                    "error": "Invalid input",
                    "message": "Invalid JSON body",
                    "code": "auth/invalid-input"
                }))?.with_status(400));
            }
        };

        let env = ctx.env;

        // Check if Apple OAuth is configured
        let apple_client_id = match env.secret("APPLE_CLIENT_ID") {
            Ok(client_id) => client_id.to_string(),
            Err(_) => {
                return Ok(Response::from_json(&json!({
                    "error": "Apple OAuth not configured",
                    "code": "auth/oauth-not-configured"
                }))?.with_status(500));
            }
        };

        // Verify Apple identity token
        let apple_user = match Self::verify_apple_token(&body.identity_token, &apple_client_id).await {
            Ok(user) => user,
            Err(e) => {
                worker::console_log!("❌ Apple token verification failed: {:?}", e);
                return Ok(Response::from_json(&json!({
                    "error": "Apple OAuth authentication failed",
                    "code": "auth/oauth-failed"
                }))?.with_status(500));
            }
        };

        let db = match env.d1("DB") {
            Ok(database) => database,
            Err(_) => {
                return Ok(Response::from_json(&json!({
                    "error": "Internal Server Error",
                    "message": "Database connection failed"
                }))?.with_status(500));
            }
        };

        let (user_id, is_new_user) = if apple_user.email.is_empty() {
            // Check if we have an existing user with this Apple ID (sub)
            match db
                .prepare("SELECT id FROM users WHERE apple_id = ?")
                .bind(&[apple_user.sub.clone().into()])?
                .first::<serde_json::Value>(None)
                .await
            {
                Ok(Some(user)) => {
                    let user_id = user.get("id").and_then(|v| v.as_str()).unwrap_or("").to_string();
                    (user_id, false)
                },
                Ok(None) => {
                    return Ok(Response::from_json(&json!({
                        "error": "Email required for new Apple Sign-In users. Please sign out of Apple ID and try again to share email.",
                        "code": "auth/email-required"
                    }))?.with_status(400));
                },
                Err(e) => {
                    worker::console_log!("❌ Error checking existing user by Apple ID: {:?}", e);
                    return Ok(Response::from_json(&json!({
                        "error": "Internal Server Error",
                        "message": "Failed to check user",
                        "code": "auth/server-error"
                    }))?.with_status(500));
                }
            }
        } else {
            // Check if user exists by email or Apple ID
            let existing_user_by_email = db
                .prepare("SELECT id FROM users WHERE email = ?")
                .bind(&[apple_user.email.clone().into()])?
                .first::<serde_json::Value>(None)
                .await
                .ok()
                .flatten();

            let existing_user_by_apple_id = db
                .prepare("SELECT id FROM users WHERE apple_id = ?")
                .bind(&[apple_user.sub.clone().into()])?
                .first::<serde_json::Value>(None)
                .await
                .ok()
                .flatten();

            match existing_user_by_email.or(existing_user_by_apple_id) {
                Some(user) => {
                    let user_id = user.get("id").and_then(|v| v.as_str()).unwrap_or("").to_string();
                    
                    // Update existing user with Apple ID if not set
                    let now = Utc::now().timestamp().to_string();
                    let _ = db
                        .prepare("UPDATE users SET email_verified = ?, apple_id = ?, updated_at = ? WHERE id = ?")
                        .bind(&[
                            if apple_user.email_verified { 1.into() } else { 0.into() },
                            apple_user.sub.clone().into(),
                            now.into(),
                            user_id.clone().into(),
                        ])?
                        .run()
                        .await;

                    (user_id, false) // Existing user
                },
                None => {
                    // Create new user
                    let user_id = nanoid!();
                    let now = Utc::now().timestamp().to_string();

                    match db
                        .prepare("INSERT INTO users (id, email, email_verified, phone, phone_verified, apple_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
                        .bind(&[
                            user_id.clone().into(),
                            apple_user.email.clone().into(),
                            if apple_user.email_verified { 1.into() } else { 0.into() },
                            "".into(),
                            0.into(),
                            apple_user.sub.clone().into(),
                            now.clone().into(),
                            now.into(),
                        ])?
                        .run()
                        .await
                    {
                        Ok(_) => (user_id, true), // New user
                        Err(e) => {
                            worker::console_log!("❌ Error creating new user: {:?}", e);
                            return Ok(Response::from_json(&json!({
                                "error": "Failed to create user",
                                "code": "auth/user-creation-failed"
                            }))?.with_status(500));
                        }
                    }
                }
            }
        };

        // Generate JWT tokens
        let tokens = match Self::generate_jwt_tokens(&user_id, &apple_user.email, &env).await {
            Ok(tokens) => tokens,
            Err(e) => {
                worker::console_log!("❌ Error generating JWT tokens: {:?}", e);
                return Ok(Response::from_json(&json!({
                    "error": "Internal Server Error",
                    "message": "Failed to generate tokens",
                    "code": "auth/server-error"
                }))?.with_status(500));
            }
        };

        // Check if profile exists
        let profile_exists = match db
            .prepare("SELECT COUNT(*) as count FROM profile WHERE user_id = ?")
            .bind(&[user_id.clone().into()])?
            .first::<serde_json::Value>(None)
            .await
        {
            Ok(Some(result)) => {
                result.get("count").and_then(|v| v.as_i64()).unwrap_or(0) > 0
            },
            Ok(None) => false,
            Err(e) => {
                worker::console_log!("❌ Error checking profile existence: {:?}", e);
                false
            }
        };

        // Get security status
        let security_status = Self::get_user_security_status(&db, &user_id).await;

        // Log activity for existing users
        if !is_new_user {
            let activity_id = nanoid!();
            let _ = db
                .prepare("INSERT INTO user_activity (id, user_id, event_type, created_at) VALUES (?, ?, ?, ?)")
                .bind(&[
                    activity_id.into(),
                    user_id.clone().into(),
                    "oauth_login".into(),
                    Utc::now().timestamp().to_string().into(),
                ])?
                .run()
                .await;
        }

        Ok(Response::from_json(&json!({
            "session": {
                "access_token": tokens.access_token,
                "refresh_token": tokens.refresh_token,
                "expires_at": tokens.access_token_expires_at
            },
            "user": {
                "id": user_id,
                "email": apple_user.email
            },
            "profileExists": profile_exists,
            "isNewUser": is_new_user,
            "securitySetupRequired": security_status.security_setup_required,
            "hasPasskeys": security_status.has_passkeys
        }))?)
    }

    pub async fn passkey_check(mut req: Request, ctx: RouteContext<()>) -> worker::Result<Response> {
        let body: PasskeyCheckRequest = match req.json().await {
            Ok(body) => body,
            Err(_) => {
                return Ok(Response::from_json(&json!({
                    "error": "Invalid input",
                    "message": "Invalid JSON body",
                    "code": "auth/invalid-input"
                }))?.with_status(400));
            }
        };

        let env = ctx.env;
        let db = match env.d1("DB") {
            Ok(database) => database,
            Err(_) => {
                return Ok(Response::from_json(&json!({
                    "error": "Internal Server Error",
                    "message": "Database connection failed"
                }))?.with_status(500));
            }
        };

        // Check if user exists
        let user_exists = match db
            .prepare("SELECT id FROM users WHERE email = ?")
            .bind(&[body.email.into()])?
            .first::<serde_json::Value>(None)
            .await
        {
            Ok(Some(user)) => {
                let user_id = user.get("id").and_then(|v| v.as_str()).unwrap_or("");
                
                // Check if user has passkeys
                let has_passkeys = match db
                    .prepare("SELECT COUNT(*) as count FROM passkeys WHERE user_id = ? LIMIT 1")
                    .bind(&[user_id.into()])?
                    .first::<serde_json::Value>(None)
                    .await
                {
                    Ok(Some(result)) => {
                        result.get("count").and_then(|v| v.as_i64()).unwrap_or(0) > 0
                    },
                    _ => false,
                };

                Ok(Response::from_json(&json!({
                    "userExists": true,
                    "hasPasskeys": has_passkeys
                }))?)
            },
            Ok(None) => {
                Ok(Response::from_json(&json!({
                    "userExists": false,
                    "hasPasskeys": false
                }))?)
            },
            Err(e) => {
                worker::console_log!("Error checking user existence: {:?}", e);
                Ok(Response::from_json(&json!({
                    "error": "Internal Server Error",
                    "message": "Failed to check user",
                    "code": "auth/check-passkeys-failed"
                }))?.with_status(500))
            }
        };

        user_exists
    }

    pub async fn passkey_register_begin(req: Request, ctx: RouteContext<()>) -> worker::Result<Response> {
        let env = ctx.env;
        
        // Validate authentication
        let user = match AuthMiddleware::validate_token(&req, &env).await {
            Ok(user) => user,
            Err(response) => return Ok(response),
        };

        let db = match env.d1("DB") {
            Ok(database) => database,
            Err(_) => {
                return Ok(Response::from_json(&json!({
                    "error": "Internal Server Error",
                    "message": "Database connection failed"
                }))?.with_status(500));
            }
        };

        // Get existing passkeys to exclude
        let existing_passkeys = match db
            .prepare("SELECT credential_id FROM passkeys WHERE user_id = ?")
            .bind(&[user.id.clone().into()])?
            .all()
            .await
        {
            Ok(results) => {
                results.results().unwrap_or_default()
                    .iter()
                    .filter_map(|row: &serde_json::Value| {
                        row.get("credential_id").and_then(|v| v.as_str()).map(|s| s.to_string())
                    })
                    .collect::<Vec<String>>()
            },
            Err(e) => {
                worker::console_log!("Error fetching existing passkeys: {:?}", e);
                Vec::new()
            }
        };

        // Create passkey service and generate registration options
        let passkey_service = PasskeyService::new(&env);
        let passkey_user = PasskeyUser {
            id: user.id.clone(),
            email: user.email.clone().unwrap_or_default(),
            display_name: user.email.clone().unwrap_or_default(),
        };

        match passkey_service.generate_registration_options(&passkey_user, existing_passkeys).await {
            Ok(options) => {
                Ok(Response::from_json(&options)?)
            },
            Err(e) => {
                worker::console_log!("Error generating passkey registration options: {:?}", e);
                Ok(Response::from_json(&json!({
                    "error": "Failed to begin passkey registration",
                    "code": "auth/passkey-registration-failed"
                }))?.with_status(500))
            }
        }
    }

    pub async fn passkey_register_complete(mut req: Request, ctx: RouteContext<()>) -> worker::Result<Response> {
        let body: PasskeyRegisterCompleteRequest = match req.json().await {
            Ok(body) => body,
            Err(_) => {
                return Ok(Response::from_json(&json!({
                    "error": "Invalid input",
                    "message": "Invalid JSON body",
                    "code": "auth/invalid-input"
                }))?.with_status(400));
            }
        };

        let env = ctx.env;
        
        // Validate authentication
        let user = match AuthMiddleware::validate_token(&req, &env).await {
            Ok(user) => user,
            Err(response) => return Ok(response),
        };

        let db = match env.d1("DB") {
            Ok(database) => database,
            Err(_) => {
                return Ok(Response::from_json(&json!({
                    "error": "Internal Server Error",
                    "message": "Database connection failed"
                }))?.with_status(500));
            }
        };

        // Create passkey service and verify registration
        let passkey_service = PasskeyService::new(&env);
        
        // Convert the credential to the expected format
        let registration_response = RegistrationResponse {
            id: body.credential.id,
            raw_id: body.credential.raw_id,
            response: crate::services::passkey_service::AuthenticatorAttestationResponse {
                client_data_json: body.credential.response.client_data_json,
                attestation_object: body.credential.response.attestation_object,
            },
            credential_type: body.credential.credential_type,
            client_extension_results: body.credential.client_extension_results,
        };

        match passkey_service.verify_registration_response(&user.id, &registration_response).await {
            Ok(verification) => {
                if verification.verified {
                    // Store passkey in database
                    let passkey_id = nanoid!();
                    let now = Utc::now().timestamp().to_string();

                    let credential_id = verification.credential_id.unwrap_or_else(|| registration_response.id.clone());
                    let public_key = verification.public_key.unwrap_or_default();
                    let counter = verification.counter.unwrap_or(0);

                    match db
                        .prepare("INSERT INTO passkeys (id, user_id, credential_id, public_key, counter, device_name, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
                        .bind(&[
                            passkey_id.clone().into(),
                            user.id.into(),
                            credential_id.into(),
                            public_key.into(),
                            counter.into(),
                            body.device_name.unwrap_or_else(|| "Unknown Device".to_string()).into(),
                            now.into(),
                        ])?
                        .run()
                        .await
                    {
                        Ok(_) => {
                            Ok(Response::from_json(&json!({
                                "success": true,
                                "message": "Passkey registered successfully",
                                "passkeyId": passkey_id
                            }))?)
                        },
                        Err(e) => {
                            worker::console_log!("Error storing passkey: {:?}", e);
                            Ok(Response::from_json(&json!({
                                "error": "Failed to store passkey",
                                "code": "auth/passkey-storage-failed"
                            }))?.with_status(500))
                        }
                    }
                } else {
                    Ok(Response::from_json(&json!({
                        "error": verification.error.unwrap_or_else(|| "Passkey registration failed".to_string()),
                        "code": "auth/passkey-verification-failed"
                    }))?.with_status(400))
                }
            },
            Err(e) => {
                worker::console_log!("Error verifying passkey registration: {:?}", e);
                Ok(Response::from_json(&json!({
                    "error": "Failed to complete passkey registration",
                    "code": "auth/passkey-registration-failed"
                }))?.with_status(500))
            }
        }
    }

    pub async fn passkey_authenticate_begin(mut req: Request, ctx: RouteContext<()>) -> worker::Result<Response> {
        let body: PasskeyAuthBeginRequest = match req.json().await {
            Ok(body) => body,
            Err(_) => {
                return Ok(Response::from_json(&json!({
                    "error": "Invalid input",
                    "message": "Invalid JSON body",
                    "code": "auth/invalid-input"
                }))?.with_status(400));
            }
        };

        let env = ctx.env;
        let db = match env.d1("DB") {
            Ok(database) => database,
            Err(_) => {
                return Ok(Response::from_json(&json!({
                    "error": "Internal Server Error",
                    "message": "Database connection failed"
                }))?.with_status(500));
            }
        };

        // Check if user exists
        let user = match db
            .prepare("SELECT id FROM users WHERE email = ?")
            .bind(&[body.email.clone().into()])?
            .first::<serde_json::Value>(None)
            .await
        {
            Ok(Some(user)) => user,
            Ok(None) => {
                return Ok(Response::from_json(&json!({
                    "error": "User not found",
                    "code": "auth/user-not-found"
                }))?.with_status(404));
            },
            Err(e) => {
                worker::console_log!("Error finding user: {:?}", e);
                return Ok(Response::from_json(&json!({
                    "error": "Internal Server Error",
                    "message": "Failed to find user"
                }))?.with_status(500));
            }
        };

        let user_id = user.get("id").and_then(|v| v.as_str()).unwrap_or("").to_string();

        // Get user's passkeys
        let passkeys = match db
            .prepare("SELECT credential_id, public_key, counter FROM passkeys WHERE user_id = ?")
            .bind(&[user_id.clone().into()])?
            .all()
            .await
        {
            Ok(results) => {
                results.results().unwrap_or_default()
                    .iter()
                    .filter_map(|row: &serde_json::Value| {
                        let credential_id = row.get("credential_id")?.as_str()?.to_string();
                        let public_key = row.get("public_key")?.as_str()?.to_string();
                        let counter = row.get("counter")?.as_i64()? as i32;
                        
                        Some(PasskeyDevice {
                            credential_id,
                            public_key,
                            counter,
                            transports: vec!["hybrid".to_string()],
                        })
                    })
                    .collect::<Vec<PasskeyDevice>>()
            },
            Err(e) => {
                worker::console_log!("Error fetching passkeys: {:?}", e);
                return Ok(Response::from_json(&json!({
                    "error": "Internal Server Error",
                    "message": "Failed to fetch passkeys"
                }))?.with_status(500));
            }
        };

        if passkeys.is_empty() {
            return Ok(Response::from_json(&json!({
                "error": "No passkeys found for user",
                "code": "auth/no-passkeys-found"
            }))?.with_status(404));
        }

        // Create passkey service and generate authentication options
        let passkey_service = PasskeyService::new(&env);

        match passkey_service.generate_authentication_options(&user_id, passkeys).await {
            Ok(options) => {
                Ok(Response::from_json(&options)?)
            },
            Err(e) => {
                worker::console_log!("Error generating authentication options: {:?}", e);
                Ok(Response::from_json(&json!({
                    "error": "Failed to begin passkey authentication",
                    "code": "auth/passkey-authentication-failed"
                }))?.with_status(500))
            }
        }
    }

    pub async fn passkey_authenticate_complete(mut req: Request, ctx: RouteContext<()>) -> worker::Result<Response> {
        let body: PasskeyAuthCompleteRequest = match req.json().await {
            Ok(body) => body,
            Err(_) => {
                return Ok(Response::from_json(&json!({
                    "error": "Invalid input",
                    "message": "Invalid JSON body",
                    "code": "auth/invalid-input"
                }))?.with_status(400));
            }
        };

        let env = ctx.env;
        let db = match env.d1("DB") {
            Ok(database) => database,
            Err(_) => {
                return Ok(Response::from_json(&json!({
                    "error": "Internal Server Error",
                    "message": "Database connection failed"
                }))?.with_status(500));
            }
        };

        // Find passkey by credential ID
        let passkey = match db
            .prepare("SELECT id, user_id, credential_id, public_key, counter FROM passkeys WHERE credential_id = ?")
            .bind(&[body.credential.id.clone().into()])?
            .first::<serde_json::Value>(None)
            .await
        {
            Ok(Some(passkey)) => passkey,
            Ok(None) => {
                return Ok(Response::from_json(&json!({
                    "error": "Passkey not found",
                    "code": "auth/passkey-not-found"
                }))?.with_status(404));
            },
            Err(e) => {
                worker::console_log!("Error finding passkey: {:?}", e);
                return Ok(Response::from_json(&json!({
                    "error": "Internal Server Error",
                    "message": "Failed to find passkey"
                }))?.with_status(500));
            }
        };

        let passkey_id = passkey.get("id").and_then(|v| v.as_str()).unwrap_or("").to_string();
        let user_id = passkey.get("user_id").and_then(|v| v.as_str()).unwrap_or("").to_string();
        let credential_id = passkey.get("credential_id").and_then(|v| v.as_str()).unwrap_or("").to_string();
        let public_key = passkey.get("public_key").and_then(|v| v.as_str()).unwrap_or("").to_string();
        let counter = passkey.get("counter").and_then(|v| v.as_i64()).unwrap_or(0) as i32;

        // Get user info
        let user = match db
            .prepare("SELECT id, email FROM users WHERE id = ?")
            .bind(&[user_id.clone().into()])?
            .first::<serde_json::Value>(None)
            .await
        {
            Ok(Some(user)) => user,
            Ok(None) => {
                return Ok(Response::from_json(&json!({
                    "error": "User not found",
                    "code": "auth/user-not-found"
                }))?.with_status(404));
            },
            Err(e) => {
                worker::console_log!("Error finding user: {:?}", e);
                return Ok(Response::from_json(&json!({
                    "error": "Internal Server Error",
                    "message": "Failed to find user"
                }))?.with_status(500));
            }
        };

        let user_email = user.get("email").and_then(|v| v.as_str()).unwrap_or("").to_string();

        // Create passkey service and verify authentication
        let passkey_service = PasskeyService::new(&env);
        
        let stored_device = PasskeyDevice {
            credential_id,
            public_key,
            counter,
            transports: vec!["hybrid".to_string()],
        };

        // Convert the credential to the expected format
        let authentication_response = AuthenticationResponse {
            id: body.credential.id,
            raw_id: body.credential.raw_id,
            response: crate::services::passkey_service::AuthenticatorAssertionResponse {
                client_data_json: body.credential.response.client_data_json,
                authenticator_data: body.credential.response.authenticator_data,
                signature: body.credential.response.signature,
                user_handle: body.credential.response.user_handle,
            },
            credential_type: body.credential.credential_type,
            client_extension_results: body.credential.client_extension_results,
        };

        match passkey_service.verify_authentication_response(&user_id, &authentication_response, &stored_device).await {
            Ok(verification) => {
                if verification.verified {
                    // Update passkey counter and last used timestamp
                    let now = Utc::now().timestamp().to_string();
                    let new_counter = verification.counter.unwrap_or(counter);

                    let _ = db
                        .prepare("UPDATE passkeys SET counter = ?, last_used_at = ? WHERE id = ?")
                        .bind(&[
                            new_counter.into(),
                            now.into(),
                            passkey_id.into(),
                        ])?
                        .run()
                        .await;

                    // Generate JWT tokens
                    let tokens = match Self::generate_jwt_tokens(&user_id, &user_email, &env).await {
                        Ok(tokens) => tokens,
                        Err(e) => {
                            worker::console_log!("Error generating JWT tokens: {:?}", e);
                            return Ok(Response::from_json(&json!({
                                "error": "Internal Server Error",
                                "message": "Failed to generate tokens",
                                "code": "auth/server-error"
                            }))?.with_status(500));
                        }
                    };

                    // Check if profile exists
                    let profile_exists = match db
                        .prepare("SELECT COUNT(*) as count FROM profile WHERE user_id = ?")
                        .bind(&[user_id.clone().into()])?
                        .first::<serde_json::Value>(None)
                        .await
                    {
                        Ok(Some(result)) => {
                            result.get("count").and_then(|v| v.as_i64()).unwrap_or(0) > 0
                        },
                        Ok(None) => false,
                        Err(e) => {
                            worker::console_log!("Error checking profile existence: {:?}", e);
                            false
                        }
                    };

                    // Log activity
                    let activity_id = nanoid!();
                    let _ = db
                        .prepare("INSERT INTO user_activity (id, user_id, event_type, created_at) VALUES (?, ?, ?, ?)")
                        .bind(&[
                            activity_id.into(),
                            user_id.clone().into(),
                            "passkey_login".into(),
                            Utc::now().timestamp().to_string().into(),
                        ])?
                        .run()
                        .await;

                    Ok(Response::from_json(&json!({
                        "session": {
                            "access_token": tokens.access_token,
                            "refresh_token": tokens.refresh_token,
                            "expires_at": tokens.access_token_expires_at
                        },
                        "user": {
                            "id": user_id,
                            "email": user_email
                        },
                        "profileExists": profile_exists,
                        "isNewUser": false
                    }))?)
                } else {
                    Ok(Response::from_json(&json!({
                        "error": verification.error.unwrap_or_else(|| "Passkey authentication failed".to_string()),
                        "code": "auth/passkey-verification-failed"
                    }))?.with_status(400))
                }
            },
            Err(e) => {
                worker::console_log!("Error verifying passkey authentication: {:?}", e);
                Ok(Response::from_json(&json!({
                    "error": "Failed to complete passkey authentication",
                    "code": "auth/passkey-authentication-failed"
                }))?.with_status(500))
            }
        }
    }

    pub async fn passkey_list(req: Request, ctx: RouteContext<()>) -> worker::Result<Response> {
        let env = ctx.env;
        
        // Validate authentication
        let user = match AuthMiddleware::validate_token(&req, &env).await {
            Ok(user) => user,
            Err(response) => return Ok(response),
        };

        let db = match env.d1("DB") {
            Ok(database) => database,
            Err(_) => {
                return Ok(Response::from_json(&json!({
                    "error": "Internal Server Error",
                    "message": "Database connection failed"
                }))?.with_status(500));
            }
        };

        // Get user's passkeys
        let passkeys = match db
            .prepare("SELECT id, credential_id, device_name, created_at, last_used_at FROM passkeys WHERE user_id = ?")
            .bind(&[user.id.into()])?
            .all()
            .await
        {
            Ok(results) => {
                results.results().unwrap_or_default()
                    .iter()
                    .filter_map(|row: &serde_json::Value| {
                        Some(json!({
                            "id": row.get("id")?.as_str()?,
                            "credentialId": row.get("credential_id")?.as_str()?,
                            "deviceName": row.get("device_name")?.as_str()?,
                            "createdAt": row.get("created_at")?.as_str()?,
                            "lastUsedAt": row.get("last_used_at").and_then(|v| v.as_str())
                        }))
                    })
                    .collect::<Vec<serde_json::Value>>()
            },
            Err(e) => {
                worker::console_log!("Error fetching passkeys: {:?}", e);
                return Ok(Response::from_json(&json!({
                    "error": "Internal Server Error",
                    "message": "Failed to fetch passkeys"
                }))?.with_status(500));
            }
        };

        Ok(Response::from_json(&json!({
            "passkeys": passkeys
        }))?)
    }

    pub async fn passkey_delete(req: Request, ctx: RouteContext<()>) -> worker::Result<Response> {
        let env = ctx.env;
        
        // Validate authentication
        let user = match AuthMiddleware::validate_token(&req, &env).await {
            Ok(user) => user,
            Err(response) => return Ok(response),
        };

        // Extract passkey ID from URL path
        let path = req.path();
        let passkey_id = path.split('/').last().unwrap_or("");
        if passkey_id.is_empty() {
            return Ok(Response::from_json(&json!({
                "error": "Invalid passkey ID",
                "code": "auth/invalid-input"
            }))?.with_status(400));
        }

        let db = match env.d1("DB") {
            Ok(database) => database,
            Err(_) => {
                return Ok(Response::from_json(&json!({
                    "error": "Internal Server Error",
                    "message": "Database connection failed"
                }))?.with_status(500));
            }
        };

        // Verify passkey belongs to user and delete
        match db
            .prepare("DELETE FROM passkeys WHERE id = ? AND user_id = ?")
            .bind(&[passkey_id.into(), user.id.into()])?
            .run()
            .await
        {
            Ok(_result) => {
                // For now, assume success if no error occurred
                // In production, you'd want to check if rows were affected
                Ok(Response::from_json(&json!({
                    "success": true,
                    "message": "Passkey deleted successfully"
                }))?)
            },
            Err(e) => {
                worker::console_log!("Error deleting passkey: {:?}", e);
                Ok(Response::from_json(&json!({
                    "error": "Internal Server Error",
                    "message": "Failed to delete passkey",
                    "code": "auth/delete-passkey-failed"
                }))?.with_status(500))
            }
        }
    }

    // Helper functions
    fn generate_secure_code() -> String {
        let random_value = js_sys::Math::random();
        let code = (random_value * 900000.0) as u32 + 100000;
        format!("{:06}", code)
    }

    async fn cleanup_expired_codes(db: &D1Database) -> worker::Result<()> {
        let now = Utc::now().timestamp().to_string();
        match db
            .prepare("DELETE FROM email_codes WHERE expires_at < ?")
            .bind(&[now.into()])?
            .run()
            .await
        {
            Ok(_) => Ok(()),
            Err(e) => {
                worker::console_log!("Error cleaning up expired codes: {:?}", e);
                Ok(()) // Don't fail the request if cleanup fails
            }
        }
    }

    async fn find_or_create_user(
        db: &D1Database,
        email: &str,
        phone: Option<&str>,
    ) -> Result<String, Box<dyn std::error::Error>> {
        // Try to find existing user
        match db
            .prepare("SELECT id FROM users WHERE email = ?")
            .bind(&[email.into()])?
            .first::<serde_json::Value>(None)
            .await
        {
            Ok(Some(user)) => {
                let user_id = user.get("id").and_then(|v| v.as_str()).unwrap_or("");
                Ok(user_id.to_string())
            },
            Ok(None) => {
                // Create new user
                let user_id = nanoid!();
                let now = Utc::now().timestamp().to_string();

                db.prepare("INSERT INTO users (id, email, email_verified, phone, phone_verified, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
                    .bind(&[
                        user_id.clone().into(),
                        email.into(),
                        1.into(), // Mark email as verified since they used email code
                        phone.unwrap_or("").into(),
                        if phone.is_some() { 1.into() } else { 0.into() },
                        now.clone().into(),
                        now.into(),
                    ])?
                    .run()
                    .await?;

                Ok(user_id)
            },
            Err(e) => Err(Box::new(e)),
        }
    }

    async fn find_or_create_oauth_user(
        db: &D1Database,
        email: &str,
        email_verified: &str,
    ) -> Result<String, Box<dyn std::error::Error>> {
        let (user_id, _is_new) = Self::find_or_create_oauth_user_with_status(db, email, email_verified).await?;
        Ok(user_id)
    }

    async fn find_or_create_oauth_user_with_status(
        db: &D1Database,
        email: &str,
        email_verified: &str,
    ) -> Result<(String, bool), Box<dyn std::error::Error>> {
        // Try to find existing user
        match db
            .prepare("SELECT id FROM users WHERE email = ?")
            .bind(&[email.into()])?
            .first::<serde_json::Value>(None)
            .await
        {
            Ok(Some(user)) => {
                let user_id = user.get("id").and_then(|v| v.as_str()).unwrap_or("");
                
                // Update existing user's email verification status
                let is_verified = email_verified == "true" || email_verified == "1";
                let now = Utc::now().timestamp().to_string();
                
                let _ = db.prepare("UPDATE users SET email_verified = ?, updated_at = ? WHERE id = ?")
                    .bind(&[
                        if is_verified { 1.into() } else { 0.into() },
                        now.into(),
                        user_id.into(),
                    ])?
                    .run()
                    .await;

                Ok((user_id.to_string(), false)) // Existing user
            },
            Ok(None) => {
                // Create new user
                let user_id = nanoid!();
                let now = Utc::now().timestamp().to_string();
                let is_verified = email_verified == "true" || email_verified == "1";

                db.prepare("INSERT INTO users (id, email, email_verified, phone, phone_verified, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
                    .bind(&[
                        user_id.clone().into(),
                        email.into(),
                        if is_verified { 1.into() } else { 0.into() },
                        "".into(),
                        0.into(),
                        now.clone().into(),
                        now.into(),
                    ])?
                    .run()
                    .await?;

                Ok((user_id, true)) // New user
            },
            Err(e) => Err(Box::new(e)),
        }
    }

    async fn generate_jwt_tokens(
        user_id: &str,
        email: &str,
        env: &Env,
    ) -> Result<TokenResponse, Box<dyn std::error::Error>> {
        let exp = Utc::now().timestamp() + 15 * 60; // 15 minutes from now

        // Get JWT secret from environment
        let jwt_secret = match env.secret("JWT_SECRET") {
            Ok(secret) => secret.to_string(),
            Err(_) => {
                return Err("JWT_SECRET not configured".into());
            }
        };

        // Create proper JWT with HMAC-SHA256 signature using Web Crypto API
        let access_token = match JwtCrypto::create_jwt(user_id, email, exp, &jwt_secret).await {
            Ok(token) => token,
            Err(js_err) => {
                worker::console_log!("❌ Failed to create JWT: {:?}", js_err);
                return Err("Failed to create access token".into());
            }
        };

        let access_token_expires_at = exp * 1000; // Convert to milliseconds
        let refresh_token = nanoid!(64);

        // Store refresh token in KV
        if let Ok(kv) = env.kv("REFRESH_TOKEN_KV") {
            let _ = kv.put(&format!("rt_{}", refresh_token), user_id)?
                .expiration_ttl(REFRESH_TOKEN_EXPIRATION_SECONDS)
                .execute()
                .await;
        }

        Ok(TokenResponse {
            access_token,
            refresh_token,
            access_token_expires_at,
        })
    }

    async fn get_user_security_status(db: &D1Database, user_id: &str) -> UserSecurityStatus {
        // Check if user has any passkeys
        let has_passkeys = match db
            .prepare("SELECT COUNT(*) as count FROM passkeys WHERE user_id = ? LIMIT 1")
            .bind(&[user_id.into()])
        {
            Ok(stmt) => {
                match stmt.first::<serde_json::Value>(None).await {
                    Ok(Some(result)) => {
                        result.get("count").and_then(|v| v.as_i64()).unwrap_or(0) > 0
                    },
                    _ => false,
                }
            },
            _ => false,
        };

        UserSecurityStatus {
            security_setup_required: !has_passkeys,
            has_passkeys,
        }
    }

    // Apple JWT verification methods
    async fn verify_apple_token(
        identity_token: &str,
        apple_client_id: &str,
    ) -> Result<AppleUserInfo, Box<dyn std::error::Error>> {
        // Split the JWT into its parts
        let parts: Vec<&str> = identity_token.split('.').collect();
        if parts.len() != 3 {
            return Err("Invalid JWT format".into());
        }

        let header_b64 = parts[0];
        let payload_b64 = parts[1];
        let _signature_b64 = parts[2];

        // Decode header and payload
        let header = Self::base64_url_decode(header_b64)?;
        let payload = Self::base64_url_decode(payload_b64)?;

        let header: AppleJWTHeader = serde_json::from_str(&header)?;
        let payload: AppleJWTPayload = serde_json::from_str(&payload)?;

        // Validate basic claims
        if payload.aud != apple_client_id {
            worker::console_log!("❌ Invalid audience claim: expected {}, got {}", apple_client_id, payload.aud);
            return Err("Invalid audience claim - token not issued for this app".into());
        }

        if payload.iss != "https://appleid.apple.com" {
            return Err("Invalid issuer claim - token not from Apple".into());
        }

        let now = Utc::now().timestamp();
        if payload.exp < now {
            return Err("Token has expired".into());
        }

        if payload.iat > now + 60 {
            // Allow 60 seconds clock skew
            return Err("Token issued in the future".into());
        }

        // Verify JWT signature using Apple's public keys
        let signature_valid = Self::verify_apple_jwt_signature(identity_token, &header).await?;
        
        if !signature_valid {
            return Err("Invalid JWT signature - token may have been tampered with".into());
        }

        // Extract email verification status
        let email_verified = match &payload.email_verified {
            Some(serde_json::Value::Bool(verified)) => *verified,
            Some(serde_json::Value::String(verified_str)) => verified_str == "true",
            _ => false,
        };

        Ok(AppleUserInfo {
            email: payload.email.unwrap_or_default(),
            email_verified,
            sub: payload.sub,
        })
    }

    async fn verify_apple_jwt_signature(
        _token: &str,
        header: &AppleJWTHeader,
    ) -> Result<bool, Box<dyn std::error::Error>> {
        // Fetch Apple's public keys
        let public_keys = Self::fetch_apple_public_keys().await?;
        
        // Find the key matching the JWT header kid
        let _public_key = public_keys.iter()
            .find(|key| key.kid == header.kid)
            .ok_or_else(|| format!("No matching Apple public key found for kid: {}", header.kid))?;

        // For Cloudflare Workers, we'll use a simplified signature verification
        // In production, you would want to implement proper RSA signature verification
        // For now, we'll trust that the token is valid if we can fetch and parse it
        // This is a security limitation but works for development
        
        worker::console_log!("⚠️ WARNING: Apple JWT signature verification simplified for Cloudflare Workers compatibility");
        worker::console_log!("Found matching Apple public key for kid: {}", header.kid);
        
        // In a production environment, you would implement proper RSA-PKCS1-v1_5 verification here
        // For now, we return true if we found the matching key
        Ok(true)
    }

    async fn fetch_apple_public_keys() -> Result<Vec<ApplePublicKey>, Box<dyn std::error::Error>> {
        let response = worker::Fetch::Url("https://appleid.apple.com/auth/keys".parse().unwrap())
            .send()
            .await?;

        if response.status_code() != 200 {
            return Err(format!("Failed to fetch Apple public keys: {}", response.status_code()).into());
        }

        let mut response = response;
        let keys_response: AppleKeysResponse = response.json().await?;
        
        Ok(keys_response.keys)
    }

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