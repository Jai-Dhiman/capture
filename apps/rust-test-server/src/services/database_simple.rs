/*!
# Simple Database Service Layer

A simplified database service with mock implementations for testing GraphQL resolvers.
This allows us to test the GraphQL layer without complex database integration.

## Usage

```rust
use crate::services::database_simple::DatabaseService;

let db_service = DatabaseService::new(env)?;
let post = db_service.get_post_by_id("post_123").await?;
```
*/

use serde_json::{json, Value};
use worker::{Env, Error as WorkerError, Result as WorkerResult};

/// Simple database service with mock implementations
pub struct DatabaseService;

impl DatabaseService {
    pub fn new(_env: &Env) -> WorkerResult<Self> {
        Ok(Self)
    }

    /// Post operations
    pub async fn get_post_by_id(&self, post_id: &str) -> WorkerResult<Option<Value>> {
        Ok(Some(json!({
            "id": post_id,
            "user_id": "user_123",
            "content": "Sample post content from database",
            "type": "text",
            "is_draft": 0,
            "editing_metadata": null,
            "version": 1,
            "created_at": "1704067200",
            "updated_at": "1704067200",
            "_save_count": 0,
            "_comment_count": 0
        })))
    }

    pub async fn get_posts_with_pagination(
        &self, 
        _limit: i64, 
        _offset: i64, 
        _user_id: Option<&str>
    ) -> WorkerResult<Vec<Value>> {
        Ok(vec![
            json!({
                "id": "post_1",
                "user_id": "user_123",
                "content": "First post",
                "type": "text",
                "is_draft": 0,
                "version": 1,
                "created_at": "1704067200",
                "updated_at": "1704067200",
                "_save_count": 5,
                "_comment_count": 2
            }),
            json!({
                "id": "post_2",
                "user_id": "user_456",
                "content": "Second post",
                "type": "text",
                "is_draft": 0,
                "version": 1,
                "created_at": "1704067100",
                "updated_at": "1704067100",
                "_save_count": 3,
                "_comment_count": 1
            })
        ])
    }

    pub async fn create_post(
        &self,
        user_id: &str,
        content: &str,
        post_type: &str,
        is_draft: bool,
        editing_metadata: Option<&str>,
    ) -> WorkerResult<Value> {
        let now = chrono::Utc::now().timestamp();
        Ok(json!({
            "id": format!("post_{}", now),
            "user_id": user_id,
            "content": content,
            "type": post_type,
            "is_draft": if is_draft { 1 } else { 0 },
            "editing_metadata": editing_metadata,
            "version": 1,
            "created_at": now.to_string(),
            "updated_at": now.to_string(),
            "_save_count": 0,
            "_comment_count": 0
        }))
    }

    pub async fn update_post(
        &self,
        post_id: &str,
        content: Option<&str>,
        post_type: Option<&str>,
        is_draft: Option<bool>,
        editing_metadata: Option<&str>,
    ) -> WorkerResult<Value> {
        let now = chrono::Utc::now().timestamp();
        Ok(json!({
            "id": post_id,
            "user_id": "user_123",
            "content": content.unwrap_or("Updated content"),
            "type": post_type.unwrap_or("text"),
            "is_draft": if is_draft.unwrap_or(false) { 1 } else { 0 },
            "editing_metadata": editing_metadata,
            "version": 2,
            "created_at": "1704067200",
            "updated_at": now.to_string(),
            "_save_count": 0,
            "_comment_count": 0
        }))
    }

    pub async fn delete_post(&self, _post_id: &str) -> WorkerResult<bool> {
        Ok(true)
    }

    /// User operations
    pub async fn get_user_by_id(&self, user_id: &str) -> WorkerResult<Option<Value>> {
        Ok(Some(json!({
            "id": user_id,
            "email": "user@example.com",
            "email_verified": 1,
            "phone": null,
            "phone_verified": 0,
            "apple_id": null,
            "created_at": "1704067200",
            "updated_at": "1704067200"
        })))
    }

    pub async fn get_user_by_username(&self, username: &str) -> WorkerResult<Option<Value>> {
        Ok(Some(json!({
            "id": "user_123",
            "email": "user@example.com",
            "email_verified": 1,
            "phone": null,
            "phone_verified": 0,
            "apple_id": null,
            "created_at": "1704067200",
            "updated_at": "1704067200",
            "username": username
        })))
    }

    /// Profile operations
    pub async fn get_profile_by_user_id(&self, user_id: &str) -> WorkerResult<Option<Value>> {
        Ok(Some(json!({
            "id": format!("profile_{}", user_id),
            "user_id": user_id,
            "username": "sample_user",
            "profile_image": null,
            "bio": "Sample bio",
            "verified_type": null,
            "is_private": 0,
            "created_at": "1704067200",
            "updated_at": "1704067200"
        })))
    }

    pub async fn update_profile(
        &self,
        user_id: &str,
        username: Option<&str>,
        profile_image: Option<&str>,
        bio: Option<&str>,
        is_private: Option<bool>,
    ) -> WorkerResult<Value> {
        let now = chrono::Utc::now().timestamp();
        Ok(json!({
            "id": format!("profile_{}", user_id),
            "user_id": user_id,
            "username": username.unwrap_or("updated_user"),
            "profile_image": profile_image,
            "bio": bio.unwrap_or("Updated bio"),
            "verified_type": null,
            "is_private": if is_private.unwrap_or(false) { 1 } else { 0 },
            "created_at": "1704067200",
            "updated_at": now.to_string()
        }))
    }

    /// Feed operations
    pub async fn get_feed_posts(&self, _limit: i64, _offset: i64) -> WorkerResult<Vec<Value>> {
        Ok(vec![
            json!({
                "id": "post_1",
                "user_id": "user_123",
                "content": "Feed post 1",
                "type": "text",
                "is_draft": 0,
                "version": 1,
                "created_at": "1704067200",
                "updated_at": "1704067200",
                "_save_count": 5,
                "_comment_count": 2,
                "user_email": "user1@example.com",
                "username": "user1",
                "profile_image": null
            }),
            json!({
                "id": "post_2",
                "user_id": "user_456",
                "content": "Feed post 2",
                "type": "text",
                "is_draft": 0,
                "version": 1,
                "created_at": "1704067100",
                "updated_at": "1704067100",
                "_save_count": 3,
                "_comment_count": 1,
                "user_email": "user2@example.com",
                "username": "user2",
                "profile_image": null
            })
        ])
    }

    /// Like operations (simplified)
    pub async fn like_post(&self, _user_id: &str, _post_id: &str) -> WorkerResult<bool> {
        Ok(true)
    }

    pub async fn unlike_post(&self, _user_id: &str, _post_id: &str) -> WorkerResult<bool> {
        Ok(true)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_get_post_by_id() {
        let service = DatabaseService;
        let result = service.get_post_by_id("test_post").await.unwrap();
        assert!(result.is_some());
        
        let post = result.unwrap();
        assert_eq!(post["id"], "test_post");
        assert_eq!(post["user_id"], "user_123");
    }

    #[tokio::test]
    async fn test_create_post() {
        let service = DatabaseService;
        let result = service.create_post("user_123", "Test content", "text", false, None).await.unwrap();
        
        assert_eq!(result["user_id"], "user_123");
        assert_eq!(result["content"], "Test content");
        assert_eq!(result["type"], "text");
        assert_eq!(result["is_draft"], 0);
    }
}