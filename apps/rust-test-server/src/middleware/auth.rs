use base64::prelude::*;
use chrono::Utc;
use serde::{Deserialize, Serialize};
use serde_json::json;
use worker::{Env, Request, Response};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthUser {
    pub id: String,
    pub email: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
struct SimpleToken {
    user_id: String,
    email: String,
    exp: i64, // expiration timestamp
}

pub struct AuthMiddleware;

impl AuthMiddleware {
    pub async fn validate_token(req: &Request, env: &Env) -> Result<AuthUser, Response> {
        // Get Authorization header
        let auth_header = match req.headers().get("Authorization") {
            Ok(Some(header)) => header,
            Ok(None) => {
                return Err(Response::from_json(&json!({
                    "error": "Unauthorized",
                    "message": "Missing Authorization header"
                }))
                .unwrap()
                .with_status(401));
            }
            Err(_) => {
                return Err(Response::from_json(&json!({
                    "error": "Unauthorized",
                    "message": "Invalid Authorization header"
                }))
                .unwrap()
                .with_status(401));
            }
        };

        // Check Bearer format
        if !auth_header.starts_with("Bearer ") {
            return Err(Response::from_json(&json!({
                "error": "Unauthorized",
                "message": "Invalid Authorization header format"
            }))
            .unwrap()
            .with_status(401));
        }

        let token = &auth_header[7..]; // Remove "Bearer " prefix

        // For simple token system, we don't need JWT_SECRET
        // But we keep this check for future compatibility
        if env.secret("JWT_SECRET").is_err() {
            return Err(Response::from_json(&json!({
                "error": "Internal Server Error",
                "message": "Auth configuration missing"
            }))
            .unwrap()
            .with_status(500));
        }

        // Decode and validate simple token
        match BASE64_STANDARD.decode(token) {
            Ok(decoded_bytes) => {
                match serde_json::from_slice::<SimpleToken>(&decoded_bytes) {
                    Ok(token_data) => {
                        // Check if token is expired
                        let current_time = Utc::now().timestamp();
                        if current_time > token_data.exp {
                            return Err(Response::from_json(&json!({
                                "error": "Unauthorized",
                                "message": "Token expired"
                            }))
                            .unwrap()
                            .with_status(401));
                        }

                        Ok(AuthUser {
                            id: token_data.user_id,
                            email: Some(token_data.email),
                        })
                    }
                    Err(err) => {
                        worker::console_log!("Token decode error: {:?}", err);
                        Err(Response::from_json(&json!({
                            "error": "Unauthorized",
                            "message": "Invalid token format"
                        }))
                        .unwrap()
                        .with_status(401))
                    }
                }
            }
            Err(err) => {
                worker::console_log!("Token base64 decode error: {:?}", err);
                Err(Response::from_json(&json!({
                    "error": "Unauthorized",
                    "message": "Invalid token encoding"
                }))
                .unwrap()
                .with_status(401))
            }
        }
    }
}
