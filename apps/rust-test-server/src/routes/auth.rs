use base64::prelude::*;
use serde::{Deserialize, Serialize};
use worker::{Request, Response, RouteContext, D1Database, Env};
use serde_json::json;
use nanoid::nanoid;
use chrono::Utc;
use crate::middleware::auth::AuthMiddleware;
use crate::services::email_service::create_email_service;

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
                worker::console_log!("Failed to fetch Google token info: {:?}", e);
                return Ok(Response::from_json(&json!({
                    "error": "Invalid Google ID token",
                    "code": "auth/invalid-token"
                }))?.with_status(401));
            }
        };

        if token_response.status_code() != 200 {
            worker::console_log!("Google token validation failed with status: {}", token_response.status_code());
            return Ok(Response::from_json(&json!({
                "error": "Invalid Google ID token",
                "code": "auth/invalid-token"
            }))?.with_status(401));
        }

        let mut token_response = token_response;
        let token_info: GoogleTokenInfo = match token_response.json().await {
            Ok(info) => info,
            Err(e) => {
                worker::console_log!("Failed to parse Google token info: {:?}", e);
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
            if token_info.aud != expected_id.to_string() {
                worker::console_log!("ID token audience mismatch: expected {}, got {}", expected_id.to_string(), token_info.aud);
                return Ok(Response::from_json(&json!({
                    "error": "ID token audience mismatch",
                    "code": "auth/invalid-audience"
                }))?.with_status(401));
            }
        } else {
            worker::console_log!("Google OAuth not configured - missing GOOGLE_CLIENT_ID");
            return Ok(Response::from_json(&json!({
                "error": "Google OAuth not configured",
                "code": "auth/oauth-not-configured"
            }))?.with_status(500));
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
                worker::console_log!("Error finding or creating Google OAuth user: {:?}", e);
                return Ok(Response::from_json(&json!({
                    "error": "Internal Server Error",
                    "message": "Failed to process OAuth login",
                    "code": "auth/oauth-failed"
                }))?.with_status(500));
            }
        };

        // Generate JWT tokens
        let tokens = match Self::generate_jwt_tokens(&user_id, &token_info.email, &env).await {
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
                "email": token_info.email
            },
            "profileExists": profile_exists,
            "isNewUser": is_new_user,
            "securitySetupRequired": security_status.security_setup_required,
            "hasPasskeys": security_status.has_passkeys
        }))?)
    }

    pub async fn oauth_apple(mut req: Request, _ctx: RouteContext<()>) -> worker::Result<Response> {
        let _body: AppleOAuthRequest = match req.json().await {
            Ok(body) => body,
            Err(_) => {
                return Ok(Response::from_json(&json!({
                    "error": "Invalid input",
                    "message": "Invalid JSON body",
                    "code": "auth/invalid-input"
                }))?.with_status(400));
            }
        };

        let env = _ctx.env;

        // Check if Apple OAuth is configured
        if env.secret("APPLE_CLIENT_ID").is_err() {
            return Ok(Response::from_json(&json!({
                "error": "Apple OAuth not configured",
                "code": "auth/oauth-not-configured"
            }))?.with_status(500));
        }

        // For now, return a placeholder response as Apple JWT verification is complex
        // In a real implementation, you would verify the identity token here
        return Ok(Response::from_json(&json!({
            "error": "Apple OAuth not fully implemented yet",
            "code": "auth/not-implemented"
        }))?.with_status(501));
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
        let _user = match AuthMiddleware::validate_token(&req, &env).await {
            Ok(user) => user,
            Err(response) => return Ok(response),
        };

        // For now, return a placeholder response as passkey implementation is complex
        // In a real implementation, you would generate WebAuthn registration options
        return Ok(Response::from_json(&json!({
            "error": "Passkey registration not fully implemented yet",
            "code": "auth/not-implemented"
        }))?.with_status(501));
    }

    pub async fn passkey_register_complete(mut req: Request, ctx: RouteContext<()>) -> worker::Result<Response> {
        let _body: PasskeyRegisterCompleteRequest = match req.json().await {
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
        let _user = match AuthMiddleware::validate_token(&req, &env).await {
            Ok(user) => user,
            Err(response) => return Ok(response),
        };

        // For now, return a placeholder response as passkey implementation is complex
        return Ok(Response::from_json(&json!({
            "error": "Passkey registration not fully implemented yet",
            "code": "auth/not-implemented"
        }))?.with_status(501));
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
        let _user = match db
            .prepare("SELECT id FROM users WHERE email = ?")
            .bind(&[body.email.into()])?
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

        // For now, return a placeholder response as passkey implementation is complex
        return Ok(Response::from_json(&json!({
            "error": "Passkey authentication not fully implemented yet",
            "code": "auth/not-implemented"
        }))?.with_status(501));
    }

    pub async fn passkey_authenticate_complete(mut req: Request, _ctx: RouteContext<()>) -> worker::Result<Response> {
        let _body: PasskeyAuthCompleteRequest = match req.json().await {
            Ok(body) => body,
            Err(_) => {
                return Ok(Response::from_json(&json!({
                    "error": "Invalid input",
                    "message": "Invalid JSON body",
                    "code": "auth/invalid-input"
                }))?.with_status(400));
            }
        };

        // For now, return a placeholder response as passkey implementation is complex
        return Ok(Response::from_json(&json!({
            "error": "Passkey authentication not fully implemented yet",
            "code": "auth/not-implemented"
        }))?.with_status(501));
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

        // For now, return empty passkeys array since D1 row access is complex
        // In a real implementation, you would properly query and parse the passkey data
        let passkeys: Vec<serde_json::Value> = vec![];

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
                // For now, assume the delete was successful if no error occurred
                // In a real implementation, you would check the result metadata properly
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

    pub async fn oauth_google(mut req: Request, _ctx: RouteContext<()>) -> worker::Result<Response> {
        let _body: GoogleOAuthRequest = match req.json().await {
            Ok(body) => body,
            Err(_) => {
                return Ok(Response::from_json(&json!({
                    "error": "Invalid input",
                    "message": "Invalid JSON body",
                    "code": "auth/invalid-input"
                }))?.with_status(400));
            }
        };

        // For now, return a placeholder response as Google OAuth code exchange is complex
        return Ok(Response::from_json(&json!({
            "error": "Google OAuth code exchange not fully implemented yet. Use /auth/oauth/google/token instead.",
            "code": "auth/not-implemented"
        }))?.with_status(501));
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
        
        let token_data = SimpleToken {
            user_id: user_id.to_string(),
            email: email.to_string(),
            exp,
        };

        let token_json = serde_json::to_string(&token_data)?;
        let access_token = BASE64_STANDARD.encode(token_json.as_bytes());
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
} 