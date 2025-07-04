/*!
# GraphQL Resolvers Module

This module contains all GraphQL resolvers organized by functionality.
Each resolver file handles a specific domain of the application.

## Module Structure

- `post.rs` - Post-related resolvers (CRUD, likes, saves, drafts, versions)
- `profile.rs` - Profile and user-related resolvers
- `comment.rs` - Comment system resolvers with hierarchical structure
- `relationship.rs` - User relationship resolvers (follow/unfollow)
- `saved_post.rs` - Saved posts functionality
- `blocking.rs` - User blocking system
- `hashtag.rs` - Hashtag operations
- `media.rs` - Media handling resolvers
- `notification.rs` - Notification system
- `discovery.rs` - AI-powered feed discovery (future)

## Usage

```rust
use crate::graphql::resolvers::*;
use crate::services::database_simple::DatabaseService;

let db_service = Arc::new(DatabaseService::new());
let engine = create_graphql_engine_with_all_resolvers(db_service);
```
*/

pub mod post;
pub mod profile;
pub mod comment;
pub mod relationship;
pub mod saved_post;
pub mod blocking;
pub mod hashtag;
pub mod media;
pub mod notification;
// TODO: Add discovery module later

use crate::graphql::{
    GraphQLEngine, GraphQLSchema, GraphQLType, ObjectType, Field, ScalarType, InputField, EnumType, EnumValue
};
use crate::services::database_simple::DatabaseService;
use std::sync::Arc;

/// Create a comprehensive GraphQL schema for the social media application
/// This matches the TypeScript schema structure from apps/server/src/graphql/schema.ts
pub fn create_social_media_schema() -> GraphQLSchema {
    let string_type = GraphQLType::Scalar(ScalarType::string());
    let int_type = GraphQLType::Scalar(ScalarType::int());
    let boolean_type = GraphQLType::Scalar(ScalarType::boolean());
    let id_type = GraphQLType::Scalar(ScalarType::string()); // ID is treated as String
    let float_type = GraphQLType::Scalar(ScalarType::float());

    // Create enums
    let post_type_enum = EnumType::new("PostType")
        .add_value("post", EnumValue::new())
        .add_value("thread", EnumValue::new());

    let comment_sort_enum = EnumType::new("CommentSortOption")
        .add_value("newest", EnumValue::new())
        .add_value("oldest", EnumValue::new());

    let notification_type_enum = EnumType::new("NotificationType")
        .add_value("FOLLOW_REQUEST", EnumValue::new())
        .add_value("NEW_FOLLOW", EnumValue::new())
        .add_value("NEW_COMMENT", EnumValue::new())
        .add_value("COMMENT_REPLY", EnumValue::new())
        .add_value("MENTION", EnumValue::new())
        .add_value("POST_SAVE", EnumValue::new());

    let change_type_enum = EnumType::new("ChangeType")
        .add_value("CREATED", EnumValue::new())
        .add_value("EDITED", EnumValue::new())
        .add_value("PUBLISHED", EnumValue::new())
        .add_value("REVERTED", EnumValue::new());

    // Create complex types
    let dimensions_type = ObjectType::new("Dimensions")
        .add_field("width", Field::new(int_type.clone()))
        .add_field("height", Field::new(int_type.clone()));

    let crop_data_type = ObjectType::new("CropData")
        .add_field("mediaId", Field::new(id_type.clone()))
        .add_field("x", Field::new(float_type.clone()))
        .add_field("y", Field::new(float_type.clone()))
        .add_field("width", Field::new(float_type.clone()))
        .add_field("height", Field::new(float_type.clone()))
        .add_field("rotation", Field::new(float_type.clone()));

    let photo_adjustments_type = ObjectType::new("PhotoAdjustments")
        .add_field("mediaId", Field::new(id_type.clone()))
        .add_field("brightness", Field::new(float_type.clone()))
        .add_field("contrast", Field::new(float_type.clone()))
        .add_field("saturation", Field::new(float_type.clone()))
        .add_field("exposure", Field::new(float_type.clone()))
        .add_field("shadows", Field::new(float_type.clone()))
        .add_field("highlights", Field::new(float_type.clone()))
        .add_field("temperature", Field::new(float_type.clone()))
        .add_field("tint", Field::new(float_type.clone()));

    let photo_filter_type = ObjectType::new("PhotoFilter")
        .add_field("mediaId", Field::new(id_type.clone()))
        .add_field("filterName", Field::new(string_type.clone()))
        .add_field("intensity", Field::new(float_type.clone()));

    let editing_metadata_type = ObjectType::new("EditingMetadata")
        .add_field("filters", Field::new(GraphQLType::List(Box::new(GraphQLType::Object(photo_filter_type.clone())))))
        .add_field("adjustments", Field::new(GraphQLType::Object(photo_adjustments_type.clone())))
        .add_field("crops", Field::new(GraphQLType::List(Box::new(GraphQLType::Object(crop_data_type.clone())))))
        .add_field("originalDimensions", Field::new(GraphQLType::Object(dimensions_type.clone())));

    // Core entity types
    let media_type = ObjectType::new("Media")
        .add_field("id", Field::new(id_type.clone()))
        .add_field("type", Field::new(string_type.clone()))
        .add_field("storageKey", Field::new(string_type.clone()))
        .add_field("order", Field::new(int_type.clone()))
        .add_field("createdAt", Field::new(string_type.clone()));

    let hashtag_type = ObjectType::new("Hashtag")
        .add_field("id", Field::new(id_type.clone()))
        .add_field("name", Field::new(string_type.clone()))
        .add_field("posts", Field::new(GraphQLType::List(Box::new(GraphQLType::Object(
            ObjectType::new("Post") // Forward reference, will be defined below
        )))))
        .add_field("createdAt", Field::new(string_type.clone()));

    let profile_type = ObjectType::new("Profile")
        .add_field("id", Field::new(id_type.clone()))
        .add_field("userId", Field::new(string_type.clone()))
        .add_field("username", Field::new(string_type.clone()))
        .add_field("profileImage", Field::new(string_type.clone()))
        .add_field("bio", Field::new(string_type.clone()))
        .add_field("verifiedType", Field::new(string_type.clone()))
        .add_field("isPrivate", Field::new(boolean_type.clone()))
        .add_field("posts", Field::new(GraphQLType::List(Box::new(GraphQLType::Object(
            ObjectType::new("Post") // Forward reference
        )))))
        .add_field("followers", Field::new(GraphQLType::List(Box::new(GraphQLType::Object(
            ObjectType::new("Profile") // Self reference
        )))))
        .add_field("following", Field::new(GraphQLType::List(Box::new(GraphQLType::Object(
            ObjectType::new("Profile") // Self reference
        )))))
        .add_field("isFollowing", Field::new(boolean_type.clone()))
        .add_field("followersCount", Field::new(int_type.clone()))
        .add_field("followingCount", Field::new(int_type.clone()))
        .add_field("createdAt", Field::new(string_type.clone()))
        .add_field("updatedAt", Field::new(string_type.clone()))
        .add_field("isBlocked", Field::new(boolean_type.clone()));

    let comment_type = ObjectType::new("Comment")
        .add_field("id", Field::new(id_type.clone()))
        .add_field("content", Field::new(string_type.clone()))
        .add_field("path", Field::new(string_type.clone()))
        .add_field("depth", Field::new(int_type.clone()))
        .add_field("parentId", Field::new(id_type.clone()))
        .add_field("isDeleted", Field::new(boolean_type.clone()))
        .add_field("user", Field::new(GraphQLType::Object(profile_type.clone())))
        .add_field("post", Field::new(GraphQLType::Object(
            ObjectType::new("Post") // Forward reference
        )))
        .add_field("createdAt", Field::new(string_type.clone()));

    let post_type = ObjectType::new("Post")
        .add_field("id", Field::new(id_type.clone()))
        .add_field("userId", Field::new(string_type.clone()))
        .add_field("content", Field::new(string_type.clone()))
        .add_field("type", Field::new(GraphQLType::Enum(post_type_enum.clone())))
        .add_field("user", Field::new(GraphQLType::Object(profile_type.clone())))
        .add_field("media", Field::new(GraphQLType::List(Box::new(GraphQLType::Object(media_type.clone())))))
        .add_field("comments", Field::new(GraphQLType::List(Box::new(GraphQLType::Object(comment_type.clone())))))
        .add_field("hashtags", Field::new(GraphQLType::List(Box::new(GraphQLType::Object(hashtag_type.clone())))))
        .add_field("savedBy", Field::new(GraphQLType::List(Box::new(GraphQLType::Object(profile_type.clone())))))
        .add_field("isSaved", Field::new(boolean_type.clone()))
        .add_field("isDraft", Field::new(boolean_type.clone()))
        .add_field("editingMetadata", Field::new(GraphQLType::Object(editing_metadata_type.clone())))
        .add_field("version", Field::new(int_type.clone()))
        .add_field("createdAt", Field::new(string_type.clone()))
        .add_field("updatedAt", Field::new(string_type.clone()))
        .add_field("_commentCount", Field::new(int_type.clone()))
        .add_field("_saveCount", Field::new(int_type.clone()));

    let draft_post_type = ObjectType::new("DraftPost")
        .add_field("id", Field::new(id_type.clone()))
        .add_field("userId", Field::new(string_type.clone()))
        .add_field("content", Field::new(string_type.clone()))
        .add_field("type", Field::new(GraphQLType::Enum(post_type_enum.clone())))
        .add_field("user", Field::new(GraphQLType::Object(profile_type.clone())))
        .add_field("media", Field::new(GraphQLType::List(Box::new(GraphQLType::Object(media_type.clone())))))
        .add_field("hashtags", Field::new(GraphQLType::List(Box::new(GraphQLType::Object(hashtag_type.clone())))))
        .add_field("editingMetadata", Field::new(GraphQLType::Object(editing_metadata_type.clone())))
        .add_field("version", Field::new(int_type.clone()))
        .add_field("createdAt", Field::new(string_type.clone()))
        .add_field("updatedAt", Field::new(string_type.clone()));

    // Response types
    let delete_post_response_type = ObjectType::new("DeletePostResponse")
        .add_field("id", Field::new(id_type.clone()))
        .add_field("success", Field::new(boolean_type.clone()));

    let save_post_response_type = ObjectType::new("SavePostResponse")
        .add_field("success", Field::new(boolean_type.clone()))
        .add_field("post", Field::new(GraphQLType::Object(post_type.clone())));

    let unsave_post_response_type = ObjectType::new("UnsavePostResponse")
        .add_field("success", Field::new(boolean_type.clone()));

    let follow_response_type = ObjectType::new("FollowResponse")
        .add_field("success", Field::new(boolean_type.clone()));

    let unfollow_response_type = ObjectType::new("UnfollowResponse")
        .add_field("success", Field::new(boolean_type.clone()));

    // Query type with all operations
    let query_type = ObjectType::new("Query")
        // Post queries
        .add_field("post", Field::new(GraphQLType::Object(post_type.clone()))
            .add_arg("id", InputField::new(GraphQLType::NonNull(Box::new(id_type.clone())))))
        .add_field("draftPost", Field::new(GraphQLType::Object(draft_post_type.clone()))
            .add_arg("id", InputField::new(GraphQLType::NonNull(Box::new(id_type.clone())))))
        .add_field("draftPosts", Field::new(GraphQLType::List(Box::new(GraphQLType::Object(draft_post_type.clone()))))
            .add_arg("limit", InputField::new(int_type.clone()))
            .add_arg("offset", InputField::new(int_type.clone())))
        
        // Profile queries
        .add_field("profile", Field::new(GraphQLType::Object(profile_type.clone()))
            .add_arg("id", InputField::new(GraphQLType::NonNull(Box::new(id_type.clone())))))
        .add_field("searchUsers", Field::new(GraphQLType::List(Box::new(GraphQLType::Object(profile_type.clone()))))
            .add_arg("query", InputField::new(GraphQLType::NonNull(Box::new(string_type.clone())))))
        
        // Comment queries
        .add_field("comments", Field::new(GraphQLType::List(Box::new(GraphQLType::Object(comment_type.clone()))))
            .add_arg("postId", InputField::new(GraphQLType::NonNull(Box::new(id_type.clone()))))
            .add_arg("parentCommentId", InputField::new(id_type.clone()))
            .add_arg("limit", InputField::new(int_type.clone()))
            .add_arg("offset", InputField::new(int_type.clone()))
            .add_arg("sortBy", InputField::new(GraphQLType::Enum(comment_sort_enum.clone()))))
        
        // Relationship queries
        .add_field("followers", Field::new(GraphQLType::List(Box::new(GraphQLType::Object(profile_type.clone()))))
            .add_arg("userId", InputField::new(GraphQLType::NonNull(Box::new(id_type.clone())))))
        .add_field("following", Field::new(GraphQLType::List(Box::new(GraphQLType::Object(profile_type.clone()))))
            .add_arg("userId", InputField::new(GraphQLType::NonNull(Box::new(id_type.clone())))))
        
        // Saved posts
        .add_field("savedPosts", Field::new(GraphQLType::List(Box::new(GraphQLType::Object(post_type.clone()))))
            .add_arg("limit", InputField::new(int_type.clone()))
            .add_arg("offset", InputField::new(int_type.clone())))
        
        // Hashtag queries
        .add_field("searchHashtags", Field::new(GraphQLType::List(Box::new(GraphQLType::Object(hashtag_type.clone()))))
            .add_arg("query", InputField::new(GraphQLType::NonNull(Box::new(string_type.clone()))))
            .add_arg("limit", InputField::new(int_type.clone()))
            .add_arg("offset", InputField::new(int_type.clone())))
        
        // Blocking queries
        .add_field("blockedUsers", Field::new(GraphQLType::List(Box::new(GraphQLType::Object(profile_type.clone())))))
        .add_field("isUserBlocked", Field::new(boolean_type.clone())
            .add_arg("userId", InputField::new(GraphQLType::NonNull(Box::new(id_type.clone())))))
        
        // Health check
        .add_field("health", Field::new(GraphQLType::Object(
            ObjectType::new("Health")
                .add_field("status", Field::new(string_type.clone()))
                .add_field("timestamp", Field::new(string_type.clone()))
        )));

    // Mutation type with all operations
    let mutation_type = ObjectType::new("Mutation")
        // Post mutations
        .add_field("createPost", Field::new(GraphQLType::Object(post_type.clone())))
        .add_field("updatePost", Field::new(GraphQLType::Object(post_type.clone())))
        .add_field("deletePost", Field::new(GraphQLType::Object(delete_post_response_type.clone())))
        
        // Draft mutations
        .add_field("saveDraftPost", Field::new(GraphQLType::Object(draft_post_type.clone())))
        .add_field("updateDraftPost", Field::new(GraphQLType::Object(draft_post_type.clone())))
        .add_field("publishDraftPost", Field::new(GraphQLType::Object(post_type.clone())))
        
        // Profile mutations
        .add_field("updateProfile", Field::new(GraphQLType::Object(profile_type.clone())))
        
        // Comment mutations
        .add_field("createComment", Field::new(GraphQLType::Object(comment_type.clone())))
        .add_field("deleteComment", Field::new(boolean_type.clone()))
        
        // Relationship mutations
        .add_field("followUser", Field::new(GraphQLType::Object(follow_response_type.clone())))
        .add_field("unfollowUser", Field::new(GraphQLType::Object(unfollow_response_type.clone())))
        
        // Save post mutations
        .add_field("savePost", Field::new(GraphQLType::Object(save_post_response_type.clone())))
        .add_field("unsavePost", Field::new(GraphQLType::Object(unsave_post_response_type.clone())))
        
        // Hashtag mutations
        .add_field("createHashtag", Field::new(GraphQLType::Object(hashtag_type.clone())))
        
        // Blocking mutations
        .add_field("blockUser", Field::new(boolean_type.clone()))
        .add_field("unblockUser", Field::new(boolean_type.clone()));

    let schema = GraphQLSchema::new(query_type)
        .with_mutation(mutation_type);

    schema
}

/// Create a GraphQL engine with all available resolvers
pub fn create_graphql_engine_with_all_resolvers(db_service: Arc<DatabaseService>) -> GraphQLEngine {
    let mut engine = GraphQLEngine::new(create_social_media_schema());
    
    // Add all resolver modules
    post::add_post_resolvers(&mut engine, db_service.clone());
    profile::add_profile_resolvers(&mut engine, db_service.clone());
    comment::add_comment_resolvers(&mut engine, db_service.clone());
    relationship::add_relationship_resolvers(&mut engine, db_service.clone());
    saved_post::add_saved_post_resolvers(&mut engine, db_service.clone());
    blocking::add_blocking_resolvers(&mut engine, db_service.clone());
    hashtag::add_hashtag_resolvers(&mut engine, db_service.clone());
    media::add_media_resolvers(&mut engine, db_service.clone());
    notification::add_notification_resolvers(&mut engine, db_service.clone());
    
    // Add health check resolvers
    add_health_check_resolvers(&mut engine);
    
    engine
}

/// Add basic health check resolvers for testing
pub fn add_health_check_resolvers(engine: &mut GraphQLEngine) {
    // TODO: Implement health check resolvers
}