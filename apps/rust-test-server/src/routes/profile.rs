use crate::middleware::auth::AuthMiddleware;
use serde::{Deserialize, Serialize};
use serde_json::json;
use worker::*;

#[derive(Deserialize, Serialize)]
struct CreateProfileRequest {
    username: String,
    bio: Option<String>,
    #[serde(rename = "profileImage")]
    profile_image: Option<String>,
    #[serde(rename = "isPrivate")]
    is_private: Option<bool>,
}

#[derive(Deserialize, Serialize)]
struct UsernameCheckResponse {
    available: bool,
    message: Option<String>,
}

#[derive(Deserialize, Serialize)]
struct ProfileResponse {
    id: String,
    #[serde(rename = "userId")]
    user_id: String,
    username: String,
    bio: Option<String>,
    #[serde(rename = "profileImage")]
    profile_image: Option<String>,
    #[serde(rename = "verifiedType")]
    verified_type: String,
    #[serde(rename = "createdAt")]
    created_at: String,
    #[serde(rename = "updatedAt")]
    updated_at: String,
}

#[derive(Deserialize, Serialize)]
struct ErrorResponse {
    message: String,
    errors: Option<Vec<String>>,
}

pub struct ProfileRoutes;

impl ProfileRoutes {
    // Check username availability (no auth required)
    pub async fn check_username_availability(
        req: Request,
        ctx: RouteContext<()>,
    ) -> Result<Response> {
        // Extract username from query parameters
        let url = req.url()?;
        let username = if let Some(query) = url.query() {
            let params: std::collections::HashMap<String, String> = query
                .split('&')
                .filter_map(|param| {
                    let mut split = param.split('=');
                    if let (Some(key), Some(value)) = (split.next(), split.next()) {
                        Some((key.to_string(), value.to_string()))
                    } else {
                        None
                    }
                })
                .collect();
            params.get("username").cloned()
        } else {
            None
        };

        let username = match username {
            Some(u) if !u.is_empty() => u,
            _ => {
                return Ok(Response::from_json(&UsernameCheckResponse {
                    available: false,
                    message: Some("Username is required".to_string()),
                })?
                .with_status(400));
            }
        };

        let db = ctx.env.d1("DB")?;

        // Check if username exists
        let stmt = db.prepare("SELECT id FROM profile WHERE username = ? LIMIT 1");
        let result = stmt
            .bind(&[username.into()])?
            .first::<serde_json::Value>(None)
            .await?;

        let available = result.is_none();
        let message = if available {
            Some("Username is available".to_string())
        } else {
            Some("Username is already taken".to_string())
        };

        Ok(Response::from_json(&UsernameCheckResponse {
            available,
            message,
        })?)
    }

    // Create profile
    pub async fn create_profile(mut req: Request, ctx: RouteContext<()>) -> Result<Response> {
        // Validate authentication
        let user = match AuthMiddleware::validate_token(&req, &ctx.env).await {
            Ok(user) => user,
            Err(response) => return Ok(response),
        };

        // Parse request body
        let body: CreateProfileRequest = match req.json().await {
            Ok(body) => body,
            Err(_) => {
                return Ok(Response::from_json(&ErrorResponse {
                    message: "Invalid JSON body".to_string(),
                    errors: None,
                })?
                .with_status(400));
            }
        };

        // Validate input
        if body.username.len() < 3 || body.username.len() > 30 {
            return Ok(Response::from_json(&ErrorResponse {
                message: "Invalid input".to_string(),
                errors: Some(vec![
                    "Username must be between 3 and 30 characters".to_string()
                ]),
            })?
            .with_status(400));
        }

        if let Some(ref bio) = body.bio {
            if bio.len() > 160 {
                return Ok(Response::from_json(&ErrorResponse {
                    message: "Invalid input".to_string(),
                    errors: Some(vec!["Bio must be 160 characters or less".to_string()]),
                })?
                .with_status(400));
            }
        }

        let db = ctx.env.d1("DB")?;

        // Check if user already has a profile
        let existing_user_profile = db.prepare("SELECT id FROM profile WHERE user_id = ? LIMIT 1");
        let existing_user = existing_user_profile
            .bind(&[user.id.clone().into()])?
            .first::<serde_json::Value>(None)
            .await?;

        if existing_user.is_some() {
            return Ok(Response::from_json(&ErrorResponse {
                message: "Profile already exists for this user".to_string(),
                errors: None,
            })?
            .with_status(400));
        }

        // Check if username is already taken
        let stmt = db.prepare("SELECT id FROM profile WHERE username = ? LIMIT 1");
        let existing = stmt
            .bind(&[body.username.clone().into()])?
            .first::<serde_json::Value>(None)
            .await?;

        if existing.is_some() {
            return Ok(Response::from_json(&ErrorResponse {
                message: "Username already taken".to_string(),
                errors: None,
            })?
            .with_status(400));
        }

        // Generate profile ID
        let profile_id = generate_nanoid();
        let now = chrono::Utc::now().to_rfc3339();

        // Insert new profile
        let insert_stmt = db.prepare(
            "INSERT INTO profile (id, user_id, username, bio, profile_image, verified_type, is_private, created_at, updated_at) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
        );

        let bio_value = body.bio.clone().unwrap_or_default();
        let profile_image_value = body.profile_image.clone().unwrap_or_default();
        let is_private_value = if body.is_private.unwrap_or(false) {
            1
        } else {
            0
        };

        insert_stmt
            .bind(&[
                profile_id.clone().into(),
                user.id.clone().into(),
                body.username.clone().into(),
                bio_value.into(),
                profile_image_value.into(),
                "none".into(),
                is_private_value.into(),
                now.clone().into(),
                now.clone().into(),
            ])?
            .run()
            .await?;

        let profile_response = ProfileResponse {
            id: profile_id,
            user_id: user.id,
            username: body.username,
            bio: if body.bio.as_ref().map_or(true, |s| s.is_empty()) {
                None
            } else {
                body.bio
            },
            profile_image: if body.profile_image.as_ref().map_or(true, |s| s.is_empty()) {
                None
            } else {
                body.profile_image
            },
            verified_type: "none".to_string(),
            created_at: now.clone(),
            updated_at: now,
        };

        Ok(Response::from_json(&json!({
            "success": true,
            "profile": profile_response
        }))?
        .with_status(201))
    }

    // Delete profile (requires authentication)
    pub async fn delete_profile(req: Request, ctx: RouteContext<()>) -> Result<Response> {
        // Validate authentication
        let user = match AuthMiddleware::validate_token(&req, &ctx.env).await {
            Ok(user) => user,
            Err(response) => return Ok(response),
        };

        // Get user ID from URL params
        let user_id = match ctx.param("userId") {
            Some(id) => id.to_string(),
            None => {
                return Ok(Response::from_json(&ErrorResponse {
                    message: "User ID parameter is required".to_string(),
                    errors: None,
                })?
                .with_status(400));
            }
        };

        // Check authorization - user can only delete their own profile
        if user_id != user.id {
            return Ok(Response::from_json(&ErrorResponse {
                message: "Unauthorized".to_string(),
                errors: Some(vec!["Cannot delete another user's profile".to_string()]),
            })?
            .with_status(403));
        }

        let db = ctx.env.d1("DB")?;

        // Check if profile exists
        let check_stmt = db.prepare("SELECT id FROM profile WHERE user_id = ? LIMIT 1");
        let existing_profile = check_stmt
            .bind(&[user_id.clone().into()])?
            .first::<serde_json::Value>(None)
            .await?;

        if existing_profile.is_none() {
            return Ok(Response::from_json(&ErrorResponse {
                message: "Profile not found".to_string(),
                errors: None,
            })?
            .with_status(404));
        }

        // Delete the profile
        let delete_stmt = db.prepare("DELETE FROM profile WHERE user_id = ?");
        delete_stmt.bind(&[user_id.into()])?.run().await?;

        // Note: In a production environment, you would want to handle cascading deletes
        // for related data like posts, comments, etc. This would require additional queries
        // or database constraints.

        Ok(Response::from_json(&json!({
            "message": "Profile deleted successfully"
        }))?)
    }
}

// Helper function to generate nanoid
fn generate_nanoid() -> String {
    nanoid::nanoid!()
}
