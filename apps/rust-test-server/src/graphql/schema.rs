use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// GraphQL Request/Response types
#[derive(Debug, Deserialize)]
pub struct GraphQLRequest {
    pub query: String,
    pub variables: Option<HashMap<String, serde_json::Value>>,
    pub operation_name: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct GraphQLResponse {
    pub data: Option<serde_json::Value>,
    pub errors: Option<Vec<GraphQLError>>,
}

#[derive(Debug, Serialize)]
pub struct GraphQLError {
    pub message: String,
    pub path: Option<Vec<String>>,
}

// Profile type matching your schema
#[derive(Deserialize, Serialize, Clone, Debug)]
pub struct Profile {
    pub id: String,
    #[serde(rename = "userId")]
    pub user_id: String,
    pub username: String,
    #[serde(rename = "profileImage")]
    pub profile_image: Option<String>,
    pub bio: Option<String>,
    #[serde(rename = "verifiedType")]
    pub verified_type: String,
    #[serde(rename = "isPrivate")]
    pub is_private: bool,
    #[serde(rename = "followersCount")]
    pub followers_count: i32,
    #[serde(rename = "followingCount")]
    pub following_count: i32,
    #[serde(rename = "createdAt")]
    pub created_at: String,
    #[serde(rename = "updatedAt")]
    pub updated_at: String,
    #[serde(rename = "isFollowing")]
    pub is_following: Option<bool>,
    #[serde(rename = "isBlocked")]
    pub is_blocked: Option<bool>,
}

// Query operations enum
#[derive(Debug)]
pub enum QueryOperation {
    Hello,
    Status,
    Profile { id: String },
}

// GraphQL Context
pub struct GraphQLContext {
    pub env: worker::Env,
    pub user_id: Option<String>,
}

impl GraphQLContext {
    pub fn new(env: worker::Env, user_id: Option<String>) -> Self {
        Self { env, user_id }
    }

    pub fn db(&self) -> worker::Result<worker::D1Database> {
        self.env.d1("DB")
    }
}
