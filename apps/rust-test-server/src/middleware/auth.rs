use crate::services::crypto::JwtCrypto;
use serde::{Deserialize, Serialize};
use serde_json::json;
use worker::{Env, Request, Response};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthUser {
    pub id: String,
    pub email: Option<String>,
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

        // Get JWT secret from environment
        let jwt_secret = match env.secret("JWT_SECRET") {
            Ok(secret) => secret.to_string(),
            Err(_) => {
                return Err(Response::from_json(&json!({
                    "error": "Internal Server Error",
                    "message": "Auth configuration missing"
                }))
                .unwrap()
                .with_status(500));
            }
        };

        // Verify JWT token
        match JwtCrypto::verify_jwt(token, &jwt_secret).await {
            Ok(payload) => Ok(AuthUser {
                id: payload.sub,
                email: Some(payload.email),
            }),
            Err(jwt_err) => {
                worker::console_log!("JWT verification failed: {:?}", jwt_err);
                Err(Response::from_json(&json!({
                    "error": "Unauthorized",
                    "message": "Invalid or expired token"
                }))
                .unwrap()
                .with_status(401))
            }
        }
    }
}
