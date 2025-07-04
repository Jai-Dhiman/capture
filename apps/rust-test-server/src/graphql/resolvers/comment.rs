/*!
# Comment Resolvers

This module handles comment-related GraphQL operations including:
- Hierarchical comment structure with path-based organization
- Comment creation and deletion
- Comment queries with sorting options
- Comment connections with cursor-based pagination

Based on TypeScript implementation in apps/server/src/graphql/resolvers/comment.ts
*/

use crate::graphql::{
    GraphQLEngine, GraphQLValue, GraphQLError, FieldContext
};
use crate::services::database_simple::DatabaseService;
use std::sync::Arc;
use serde_json::{json, Value};

/// Add comment resolvers to the GraphQL engine
pub fn add_comment_resolvers(engine: &mut GraphQLEngine, _db_service: Arc<DatabaseService>) {
    // TODO: Implement comment resolvers
    // Query resolvers:
    // - comments(postId, parentCommentId, limit, offset, sortBy)
    // - comment(id)
    // - commentConnection(postId, parentId, sortBy, cursor, limit)
    
    // Mutation resolvers:
    // - createComment(input)
    // - deleteComment(id)
}

/// Get comments for a specific post
pub fn get_comments_resolver(ctx: &FieldContext, _db_service: &DatabaseService) -> Result<GraphQLValue, GraphQLError> {
    let _post_id = ctx.field_info.arguments
        .get("postId")
        .and_then(|v| v.as_str())
        .ok_or_else(|| GraphQLError::new("Missing required argument 'postId'"))?;

    // TODO: Implement actual comment retrieval with hierarchical structure
    let mock_comments = vec![
        json!({
            "id": "comment_1",
            "content": "Great post!",
            "path": "1",
            "depth": 0,
            "parentId": null,
            "isDeleted": false,
            "user": {
                "id": "profile_1",
                "username": "commenter1",
                "profileImage": null
            },
            "createdAt": "2024-01-01T00:00:00Z"
        })
    ];

    Ok(GraphQLValue::List(mock_comments.into_iter().map(GraphQLValue::from).collect()))
}

/// Get a specific comment by ID
pub fn get_comment_resolver(ctx: &FieldContext, _db_service: &DatabaseService) -> Result<GraphQLValue, GraphQLError> {
    let comment_id = ctx.field_info.arguments
        .get("id")
        .and_then(|v| v.as_str())
        .ok_or_else(|| GraphQLError::new("Missing required argument 'id'"))?;

    // TODO: Implement actual comment retrieval
    let mock_comment = json!({
        "id": comment_id,
        "content": "Sample comment content",
        "path": "1",
        "depth": 0,
        "parentId": null,
        "isDeleted": false,
        "user": {
            "id": "profile_1",
            "username": "commenter",
            "profileImage": null
        },
        "createdAt": "2024-01-01T00:00:00Z"
    });

    Ok(GraphQLValue::from(mock_comment))
}

/// Create a new comment
pub fn create_comment_resolver(ctx: &FieldContext, _db_service: &DatabaseService) -> Result<GraphQLValue, GraphQLError> {
    let _input = ctx.field_info.arguments
        .get("input")
        .ok_or_else(|| GraphQLError::new("Missing required argument 'input'"))?;

    // TODO: Implement comment creation with proper path generation and notifications
    let mock_comment = json!({
        "id": "new_comment_1",
        "content": "New comment content",
        "path": "1",
        "depth": 0,
        "parentId": null,
        "isDeleted": false,
        "user": {
            "id": "profile_1",
            "username": "author",
            "profileImage": null
        },
        "createdAt": "2024-01-01T00:00:00Z"
    });

    Ok(GraphQLValue::from(mock_comment))
}

/// Delete a comment
pub fn delete_comment_resolver(ctx: &FieldContext, _db_service: &DatabaseService) -> Result<GraphQLValue, GraphQLError> {
    let comment_id = ctx.field_info.arguments
        .get("id")
        .and_then(|v| v.as_str())
        .ok_or_else(|| GraphQLError::new("Missing required argument 'id'"))?;

    // TODO: Implement comment deletion (soft delete by setting isDeleted = true)
    let response = json!({
        "id": comment_id,
        "success": true
    });

    Ok(GraphQLValue::from(response))
}

// Helper functions for hierarchical comment structure

/// Generate comment path for hierarchical organization
fn generate_comment_path(parent_path: Option<&str>, parent_id: Option<&str>) -> String {
    match (parent_path, parent_id) {
        (Some(path), Some(_)) => {
            // Find next available path number under parent
            // In real implementation, query database for existing children
            format!("{}.1", path)
        }
        _ => {
            // Root level comment
            // In real implementation, query database for next root comment number
            "1".to_string()
        }
    }
}

/// Calculate comment depth from path
fn calculate_depth(path: &str) -> i32 {
    path.split('.').count() as i32 - 1
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_generate_comment_path() {
        assert_eq!(generate_comment_path(None, None), "1");
        assert_eq!(generate_comment_path(Some("1"), Some("comment_1")), "1.1");
        assert_eq!(generate_comment_path(Some("1.2"), Some("comment_2")), "1.2.1");
    }

    #[test]
    fn test_calculate_depth() {
        assert_eq!(calculate_depth("1"), 0);
        assert_eq!(calculate_depth("1.1"), 1);
        assert_eq!(calculate_depth("1.2.3"), 2);
    }
}