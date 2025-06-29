pub mod profile;

use crate::graphql::schema::{GraphQLContext, QueryOperation};
use worker::*;

// Main query resolver - routes to specific resolvers
pub async fn resolve_query(
    operation: QueryOperation,
    ctx: &GraphQLContext,
) -> Result<serde_json::Value> {
    match operation {
        QueryOperation::Hello => Ok(serde_json::json!({
            "message": "Hello from Rust GraphQL!",
            "timestamp": chrono::Utc::now().to_rfc3339()
        })),

        QueryOperation::Status => Ok(serde_json::json!("OK")),

        QueryOperation::Profile { id } => profile::resolve_profile(&id, ctx).await,
    }
}
