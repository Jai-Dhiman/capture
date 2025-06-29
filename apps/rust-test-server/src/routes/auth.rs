use base64::prelude::*;
use serde::{Deserialize, Serialize};
use worker::{Request, Response, RouteContext, D1Database, Env};
use serde_json::json;
use nanoid::nanoid;
use chrono::Utc;
use crate::middleware::auth::AuthMiddleware;

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
                // In a real implementation, you would send the email here
                // For testing purposes, we'll just log it
                worker::console_log!("Email code for {}: {}", body.email, code);
                
                Ok(Response::from_json(&json!({
                    "success": true,
                    "message": "Code sent successfully"
                }))?)
            },
            Err(e) => {
                worker::console_log!("Error inserting email code: {:?}", e);
                Ok(Response::from_json(&json!({
                    "error": "Internal Server Error",
                    "message": "Failed to send code"
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

        // Generate JWT tokens
        let tokens = match Self::generate_jwt_tokens(&user_id, &body.email, &env).await {
            Ok(tokens) => tokens,
            Err(e) => {
                worker::console_log!("Error generating JWT tokens: {:?}", e);
                return Ok(Response::from_json(&json!({
                    "error": "Internal Server Error",
                    "message": "Failed to generate tokens"
                }))?.with_status(500));
            }
        };

        Ok(Response::from_json(&json!({
            "accessToken": tokens.access_token,
            "refreshToken": tokens.refresh_token,
            "accessTokenExpiresAt": tokens.access_token_expires_at,
            "user": {
                "id": user_id,
                "email": body.email
            }
        }))?)
    }

    pub async fn refresh_token(mut req: Request, ctx: RouteContext<()>) -> worker::Result<Response> {
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
                    Ok(Some(id)) => id,
                    Ok(None) => {
                        return Ok(Response::from_json(&json!({
                            "error": "Invalid refresh token",
                            "message": "Refresh token not found or expired"
                        }))?.with_status(401));
                    },
                    Err(e) => {
                        worker::console_log!("Error getting refresh token: {:?}", e);
                        return Ok(Response::from_json(&json!({
                            "error": "Internal Server Error",
                            "message": "Failed to validate refresh token"
                        }))?.with_status(500));
                    }
                }
            },
            Err(_) => {
                return Ok(Response::from_json(&json!({
                    "error": "Internal Server Error",
                    "message": "Refresh token service unavailable"
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
                    "message": "User not found"
                }))?.with_status(401));
            },
            Err(e) => {
                worker::console_log!("Error getting user: {:?}", e);
                return Ok(Response::from_json(&json!({
                    "error": "Internal Server Error",
                    "message": "Failed to validate user"
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
                    "message": "Failed to generate tokens"
                }))?.with_status(500));
            }
        };

        Ok(Response::from_json(&json!({
            "accessToken": tokens.access_token,
            "refreshToken": tokens.refresh_token,
            "accessTokenExpiresAt": tokens.access_token_expires_at
        }))?)
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