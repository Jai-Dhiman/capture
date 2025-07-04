/*!
# Hashtag Resolvers

This module handles hashtag GraphQL operations including:
- Hashtag search functionality
- Hashtag creation
- Hashtag-to-posts relationships

Based on TypeScript implementation in apps/server/src/graphql/resolvers/hashtag.ts
*/

use crate::graphql::{
    GraphQLEngine, GraphQLValue, GraphQLError, FieldContext
};
use crate::services::database_simple::DatabaseService;
use std::sync::Arc;
use serde_json::{json, Value};

/// Add hashtag resolvers to the GraphQL engine
pub fn add_hashtag_resolvers(engine: &mut GraphQLEngine, _db_service: Arc<DatabaseService>) {
    // TODO: Implement hashtag resolvers
    // Query resolvers:
    // - searchHashtags(query, limit, offset)
    
    // Mutation resolvers:
    // - createHashtag(name)
    
    // Type resolvers:
    // - Hashtag.posts
}

/// Search hashtags by query string
pub fn search_hashtags_resolver(ctx: &FieldContext, _db_service: &DatabaseService) -> Result<GraphQLValue, GraphQLError> {
    let query = ctx.field_info.arguments
        .get("query")
        .and_then(|v| v.as_str())
        .ok_or_else(|| GraphQLError::new("Missing required argument 'query'"))?;

    let _limit = ctx.field_info.arguments
        .get("limit")
        .and_then(|v| v.as_i64())
        .unwrap_or(10);

    let _offset = ctx.field_info.arguments
        .get("offset")
        .and_then(|v| v.as_i64())
        .unwrap_or(0);

    // TODO: Implement actual hashtag search with fuzzy matching
    // Normalize hashtag names (remove # prefix if present)
    let normalized_query = normalize_hashtag_name(query);
    
    let mock_hashtags = vec![
        json!({
            "id": "hashtag_1",
            "name": normalized_query,
            "posts": [], // Will be resolved by type resolver
            "createdAt": "2024-01-01T00:00:00Z"
        })
    ];

    Ok(GraphQLValue::List(mock_hashtags.into_iter().map(GraphQLValue::from).collect()))
}

/// Create a new hashtag
pub fn create_hashtag_resolver(ctx: &FieldContext, _db_service: &DatabaseService) -> Result<GraphQLValue, GraphQLError> {
    let name = ctx.field_info.arguments
        .get("name")
        .and_then(|v| v.as_str())
        .ok_or_else(|| GraphQLError::new("Missing required argument 'name'"))?;

    // TODO: Implement actual hashtag creation
    // - Normalize hashtag name
    // - Check if hashtag already exists
    // - Create new hashtag record
    
    let normalized_name = normalize_hashtag_name(name);
    
    let hashtag = json!({
        "id": "new_hashtag_1",
        "name": normalized_name,
        "posts": [],
        "createdAt": "2024-01-01T00:00:00Z"
    });

    Ok(GraphQLValue::from(hashtag))
}

/// Get posts for a specific hashtag (type resolver)
pub fn get_hashtag_posts(_hashtag_id: &str, _db_service: &DatabaseService) -> Result<GraphQLValue, GraphQLError> {
    // TODO: Implement actual posts retrieval for hashtag
    let mock_posts = vec![
        json!({
            "id": "post_1",
            "userId": "user_1",
            "content": "Post with hashtag",
            "type": "post",
            "user": {
                "id": "profile_1",
                "username": "author",
                "profileImage": null
            },
            "media": [],
            "comments": [],
            "hashtags": [],
            "savedBy": [],
            "isSaved": false,
            "isDraft": false,
            "editingMetadata": null,
            "version": 1,
            "createdAt": "2024-01-01T00:00:00Z",
            "updatedAt": "2024-01-01T00:00:00Z",
            "_commentCount": 0,
            "_saveCount": 0
        })
    ];

    Ok(GraphQLValue::List(mock_posts.into_iter().map(GraphQLValue::from).collect()))
}

// Helper functions

/// Normalize hashtag name by removing # prefix and converting to lowercase
fn normalize_hashtag_name(name: &str) -> String {
    let trimmed = name.trim();
    if trimmed.starts_with('#') {
        trimmed[1..].to_lowercase()
    } else {
        trimmed.to_lowercase()
    }
}

/// Extract hashtags from content text
pub fn extract_hashtags_from_content(content: &str) -> Vec<String> {
    // TODO: Implement regex-based hashtag extraction
    // Look for patterns like #hashtag in the content
    let mut hashtags = Vec::new();
    
    // Simple implementation - in real version use regex
    for word in content.split_whitespace() {
        if word.starts_with('#') && word.len() > 1 {
            hashtags.push(normalize_hashtag_name(word));
        }
    }
    
    hashtags
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_normalize_hashtag_name() {
        assert_eq!(normalize_hashtag_name("#rust"), "rust");
        assert_eq!(normalize_hashtag_name("RUST"), "rust");
        assert_eq!(normalize_hashtag_name(" #GraphQL "), "graphql");
        assert_eq!(normalize_hashtag_name("nohashtag"), "nohashtag");
    }

    #[test]
    fn test_extract_hashtags_from_content() {
        let content = "Check out this #rust #GraphQL implementation! #awesome";
        let hashtags = extract_hashtags_from_content(content);
        assert_eq!(hashtags, vec!["rust", "graphql", "awesome"]);
    }
}