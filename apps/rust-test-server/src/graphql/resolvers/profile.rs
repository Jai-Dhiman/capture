/*!
# Profile GraphQL Resolvers

This module contains the GraphQL resolvers for user profile operations including
profile creation, updates, and profile-related queries.

## Features

- Profile CRUD operations
- Username availability checking
- Profile privacy settings
- Profile verification status
- User relationship management

## Usage

```rust
use crate::graphql::resolvers::profile::*;

// Add resolvers to GraphQL engine
add_profile_resolvers(&mut engine, db_service);
```
*/

use crate::graphql::{
    FieldContext, GraphQLError, GraphQLValue, GraphQLEngine
};
use crate::services::database_simple::DatabaseService;
use serde_json::Value;
use std::collections::HashMap;
use std::sync::Arc;

/// Add all profile-related resolvers to the GraphQL engine
pub fn add_profile_resolvers(engine: &mut GraphQLEngine, db_service: Arc<DatabaseService>) {
    // Query resolvers
    {
        let db_clone = db_service.clone();
        engine.add_resolver("Query", "profile", move |ctx| {
            get_profile_resolver(ctx, &db_clone)
        });
    }

    {
        let db_clone = db_service.clone();
        engine.add_resolver("Query", "userByUsername", move |ctx| {
            get_user_by_username_resolver(ctx, &db_clone)
        });
    }

    {
        let db_clone = db_service.clone();
        engine.add_resolver("Query", "checkUsernameAvailability", move |ctx| {
            check_username_availability_resolver(ctx, &db_clone)
        });
    }

    // Mutation resolvers
    {
        let db_clone = db_service.clone();
        engine.add_resolver("Mutation", "updateProfile", move |ctx| {
            update_profile_resolver(ctx, &db_clone)
        });
    }

    {
        let db_clone = db_service.clone();
        engine.add_resolver("Mutation", "createProfile", move |ctx| {
            create_profile_resolver(ctx, &db_clone)
        });
    }

    {
        let db_clone = db_service.clone();
        engine.add_resolver("Mutation", "deleteProfile", move |ctx| {
            delete_profile_resolver(ctx, &db_clone)
        });
    }

    {
        let db_clone = db_service.clone();
        engine.add_resolver("Mutation", "followUser", move |ctx| {
            follow_user_resolver(ctx, &db_clone)
        });
    }

    {
        let db_clone = db_service.clone();
        engine.add_resolver("Mutation", "unfollowUser", move |ctx| {
            unfollow_user_resolver(ctx, &db_clone)
        });
    }

    {
        let db_clone = db_service.clone();
        engine.add_resolver("Mutation", "blockUser", move |ctx| {
            block_user_resolver(ctx, &db_clone)
        });
    }

    {
        let db_clone = db_service.clone();
        engine.add_resolver("Mutation", "unblockUser", move |ctx| {
            unblock_user_resolver(ctx, &db_clone)
        });
    }
}

/// Helper function to convert database value to GraphQL value
fn value_to_graphql_value(value: &Value) -> GraphQLValue {
    match value {
        Value::Null => GraphQLValue::Null,
        Value::Bool(b) => GraphQLValue::Boolean(*b),
        Value::Number(n) => {
            if let Some(i) = n.as_i64() {
                GraphQLValue::Int(i)
            } else if let Some(f) = n.as_f64() {
                GraphQLValue::Float(f)
            } else {
                GraphQLValue::String(n.to_string())
            }
        }
        Value::String(s) => GraphQLValue::String(s.clone()),
        Value::Array(arr) => {
            GraphQLValue::List(arr.iter().map(value_to_graphql_value).collect())
        }
        Value::Object(obj) => {
            let map: HashMap<String, GraphQLValue> = obj
                .iter()
                .map(|(k, v)| (k.clone(), value_to_graphql_value(v)))
                .collect();
            GraphQLValue::Object(map)
        }
    }
}

/// Helper function to convert database profile to GraphQL profile
fn profile_to_graphql_value(profile: &Value) -> GraphQLValue {
    let mut result = HashMap::new();
    
    if let Value::Object(obj) = profile {
        // Map database fields to GraphQL fields
        if let Some(id) = obj.get("id") {
            result.insert("id".to_string(), value_to_graphql_value(id));
        }
        if let Some(user_id) = obj.get("user_id") {
            result.insert("userId".to_string(), value_to_graphql_value(user_id));
        }
        if let Some(username) = obj.get("username") {
            result.insert("username".to_string(), value_to_graphql_value(username));
        }
        if let Some(profile_image) = obj.get("profile_image") {
            result.insert("profileImage".to_string(), value_to_graphql_value(profile_image));
        }
        if let Some(bio) = obj.get("bio") {
            result.insert("bio".to_string(), value_to_graphql_value(bio));
        }
        if let Some(verified_type) = obj.get("verified_type") {
            result.insert("verifiedType".to_string(), value_to_graphql_value(verified_type));
        }
        if let Some(is_private) = obj.get("is_private") {
            // Convert integer to boolean
            let private_bool = is_private.as_i64().unwrap_or(0) != 0;
            result.insert("isPrivate".to_string(), GraphQLValue::Boolean(private_bool));
        }
        if let Some(created_at) = obj.get("created_at") {
            result.insert("createdAt".to_string(), value_to_graphql_value(created_at));
        }
        if let Some(updated_at) = obj.get("updated_at") {
            result.insert("updatedAt".to_string(), value_to_graphql_value(updated_at));
        }
    }

    // Add empty arrays for related data that would be resolved separately
    result.insert("followers".to_string(), GraphQLValue::List(vec![]));
    result.insert("following".to_string(), GraphQLValue::List(vec![]));
    result.insert("posts".to_string(), GraphQLValue::List(vec![]));

    GraphQLValue::Object(result)
}

/// Helper function to convert database user to GraphQL user
fn user_to_graphql_value(user: &Value) -> GraphQLValue {
    let mut result = HashMap::new();
    
    if let Value::Object(obj) = user {
        // Map database fields to GraphQL fields
        if let Some(id) = obj.get("id") {
            result.insert("id".to_string(), value_to_graphql_value(id));
        }
        if let Some(email) = obj.get("email") {
            result.insert("email".to_string(), value_to_graphql_value(email));
        }
        if let Some(email_verified) = obj.get("email_verified") {
            let verified_bool = email_verified.as_i64().unwrap_or(0) != 0;
            result.insert("emailVerified".to_string(), GraphQLValue::Boolean(verified_bool));
        }
        if let Some(phone) = obj.get("phone") {
            result.insert("phone".to_string(), value_to_graphql_value(phone));
        }
        if let Some(phone_verified) = obj.get("phone_verified") {
            let verified_bool = phone_verified.as_i64().unwrap_or(0) != 0;
            result.insert("phoneVerified".to_string(), GraphQLValue::Boolean(verified_bool));
        }
        if let Some(apple_id) = obj.get("apple_id") {
            result.insert("appleId".to_string(), value_to_graphql_value(apple_id));
        }
        if let Some(created_at) = obj.get("created_at") {
            result.insert("createdAt".to_string(), value_to_graphql_value(created_at));
        }
        if let Some(updated_at) = obj.get("updated_at") {
            result.insert("updatedAt".to_string(), value_to_graphql_value(updated_at));
        }
    }

    // Add empty objects/arrays for related data
    result.insert("profile".to_string(), GraphQLValue::Null);
    result.insert("posts".to_string(), GraphQLValue::List(vec![]));

    GraphQLValue::Object(result)
}

/// Query Resolvers

pub fn get_profile_resolver(ctx: &FieldContext, db_service: &DatabaseService) -> Result<GraphQLValue, GraphQLError> {
    let user_id = ctx.field_info.arguments
        .get("userId")
        .and_then(|v| v.as_str())
        .ok_or_else(|| GraphQLError::new("Missing required argument 'userId'"))?;

    // Mock implementation - return sample profile data
    let mut profile = HashMap::new();
    profile.insert("id".to_string(), GraphQLValue::String("profile_123".to_string()));
    profile.insert("userId".to_string(), GraphQLValue::String(user_id.to_string()));
    profile.insert("username".to_string(), GraphQLValue::String("sample_user".to_string()));
    profile.insert("profileImage".to_string(), GraphQLValue::Null);
    profile.insert("bio".to_string(), GraphQLValue::String("Sample bio".to_string()));
    profile.insert("verifiedType".to_string(), GraphQLValue::Null);
    profile.insert("isPrivate".to_string(), GraphQLValue::Boolean(false));
    profile.insert("createdAt".to_string(), GraphQLValue::String("2024-01-01T00:00:00Z".to_string()));
    profile.insert("updatedAt".to_string(), GraphQLValue::String("2024-01-01T00:00:00Z".to_string()));
    profile.insert("followers".to_string(), GraphQLValue::List(vec![]));
    profile.insert("following".to_string(), GraphQLValue::List(vec![]));
    profile.insert("posts".to_string(), GraphQLValue::List(vec![]));

    Ok(GraphQLValue::Object(profile))
}

pub fn get_user_by_username_resolver(ctx: &FieldContext, db_service: &DatabaseService) -> Result<GraphQLValue, GraphQLError> {
    let username = ctx.field_info.arguments
        .get("username")
        .and_then(|v| v.as_str())
        .ok_or_else(|| GraphQLError::new("Missing required argument 'username'"))?;

    // Mock implementation - return sample user data
    let mut user = HashMap::new();
    user.insert("id".to_string(), GraphQLValue::String("user_123".to_string()));
    user.insert("email".to_string(), GraphQLValue::String("user@example.com".to_string()));
    user.insert("emailVerified".to_string(), GraphQLValue::Boolean(true));
    user.insert("phone".to_string(), GraphQLValue::Null);
    user.insert("phoneVerified".to_string(), GraphQLValue::Boolean(false));
    user.insert("appleId".to_string(), GraphQLValue::Null);
    user.insert("createdAt".to_string(), GraphQLValue::String("2024-01-01T00:00:00Z".to_string()));
    user.insert("updatedAt".to_string(), GraphQLValue::String("2024-01-01T00:00:00Z".to_string()));
    
    // Add profile data
    let mut profile = HashMap::new();
    profile.insert("id".to_string(), GraphQLValue::String("profile_123".to_string()));
    profile.insert("userId".to_string(), GraphQLValue::String("user_123".to_string()));
    profile.insert("username".to_string(), GraphQLValue::String(username.to_string()));
    profile.insert("profileImage".to_string(), GraphQLValue::Null);
    profile.insert("bio".to_string(), GraphQLValue::String("Sample bio".to_string()));
    profile.insert("verifiedType".to_string(), GraphQLValue::Null);
    profile.insert("isPrivate".to_string(), GraphQLValue::Boolean(false));
    profile.insert("createdAt".to_string(), GraphQLValue::String("2024-01-01T00:00:00Z".to_string()));
    profile.insert("updatedAt".to_string(), GraphQLValue::String("2024-01-01T00:00:00Z".to_string()));
    
    user.insert("profile".to_string(), GraphQLValue::Object(profile));
    user.insert("posts".to_string(), GraphQLValue::List(vec![]));

    Ok(GraphQLValue::Object(user))
}

pub fn check_username_availability_resolver(ctx: &FieldContext, db_service: &DatabaseService) -> Result<GraphQLValue, GraphQLError> {
    let username = ctx.field_info.arguments
        .get("username")
        .and_then(|v| v.as_str())
        .ok_or_else(|| GraphQLError::new("Missing required argument 'username'"))?;

    // Mock implementation - for now, assume all usernames are available
    let mut result = HashMap::new();
    result.insert("available".to_string(), GraphQLValue::Boolean(true));
    result.insert("username".to_string(), GraphQLValue::String(username.to_string()));
    result.insert("suggestions".to_string(), GraphQLValue::List(vec![]));

    Ok(GraphQLValue::Object(result))
}

/// Mutation Resolvers

pub fn create_profile_resolver(ctx: &FieldContext, db_service: &DatabaseService) -> Result<GraphQLValue, GraphQLError> {
    let _username = ctx.field_info.arguments
        .get("input")
        .and_then(|v| v.get("username"))
        .and_then(|v| v.as_str())
        .ok_or_else(|| GraphQLError::new("Missing required field 'username' in input"))?;

    let _bio = ctx.field_info.arguments
        .get("input")
        .and_then(|v| v.get("bio"))
        .and_then(|v| v.as_str());

    let _is_private = ctx.field_info.arguments
        .get("input")
        .and_then(|v| v.get("isPrivate"))
        .and_then(|v| v.as_bool())
        .unwrap_or(false);

    // Mock implementation
    let mut profile = HashMap::new();
    profile.insert("id".to_string(), GraphQLValue::String("new_profile_123".to_string()));
    profile.insert("userId".to_string(), GraphQLValue::String("user_123".to_string()));
    profile.insert("username".to_string(), GraphQLValue::String("new_username".to_string()));
    profile.insert("profileImage".to_string(), GraphQLValue::Null);
    profile.insert("bio".to_string(), GraphQLValue::String("New bio".to_string()));
    profile.insert("verifiedType".to_string(), GraphQLValue::Null);
    profile.insert("isPrivate".to_string(), GraphQLValue::Boolean(false));
    profile.insert("createdAt".to_string(), GraphQLValue::String("2024-01-01T00:00:00Z".to_string()));
    profile.insert("updatedAt".to_string(), GraphQLValue::String("2024-01-01T00:00:00Z".to_string()));
    profile.insert("followers".to_string(), GraphQLValue::List(vec![]));
    profile.insert("following".to_string(), GraphQLValue::List(vec![]));
    profile.insert("posts".to_string(), GraphQLValue::List(vec![]));

    Ok(GraphQLValue::Object(profile))
}

pub fn update_profile_resolver(ctx: &FieldContext, db_service: &DatabaseService) -> Result<GraphQLValue, GraphQLError> {
    let _username = ctx.field_info.arguments
        .get("input")
        .and_then(|v| v.get("username"))
        .and_then(|v| v.as_str());

    let _bio = ctx.field_info.arguments
        .get("input")
        .and_then(|v| v.get("bio"))
        .and_then(|v| v.as_str());

    let _profile_image = ctx.field_info.arguments
        .get("input")
        .and_then(|v| v.get("profileImage"))
        .and_then(|v| v.as_str());

    let _is_private = ctx.field_info.arguments
        .get("input")
        .and_then(|v| v.get("isPrivate"))
        .and_then(|v| v.as_bool());

    // Mock implementation
    let mut profile = HashMap::new();
    profile.insert("id".to_string(), GraphQLValue::String("profile_123".to_string()));
    profile.insert("userId".to_string(), GraphQLValue::String("user_123".to_string()));
    profile.insert("username".to_string(), GraphQLValue::String("updated_username".to_string()));
    profile.insert("profileImage".to_string(), GraphQLValue::Null);
    profile.insert("bio".to_string(), GraphQLValue::String("Updated bio".to_string()));
    profile.insert("verifiedType".to_string(), GraphQLValue::Null);
    profile.insert("isPrivate".to_string(), GraphQLValue::Boolean(false));
    profile.insert("createdAt".to_string(), GraphQLValue::String("2024-01-01T00:00:00Z".to_string()));
    profile.insert("updatedAt".to_string(), GraphQLValue::String("2024-01-01T01:00:00Z".to_string()));
    profile.insert("followers".to_string(), GraphQLValue::List(vec![]));
    profile.insert("following".to_string(), GraphQLValue::List(vec![]));
    profile.insert("posts".to_string(), GraphQLValue::List(vec![]));

    Ok(GraphQLValue::Object(profile))
}

pub fn delete_profile_resolver(ctx: &FieldContext, db_service: &DatabaseService) -> Result<GraphQLValue, GraphQLError> {
    let _user_id = ctx.field_info.arguments
        .get("userId")
        .and_then(|v| v.as_str())
        .ok_or_else(|| GraphQLError::new("Missing required argument 'userId'"))?;

    // Mock implementation
    Ok(GraphQLValue::Boolean(true))
}

pub fn follow_user_resolver(ctx: &FieldContext, db_service: &DatabaseService) -> Result<GraphQLValue, GraphQLError> {
    let _user_id = ctx.field_info.arguments
        .get("userId")
        .and_then(|v| v.as_str())
        .ok_or_else(|| GraphQLError::new("Missing required argument 'userId'"))?;

    // Mock implementation
    Ok(GraphQLValue::Boolean(true))
}

pub fn unfollow_user_resolver(ctx: &FieldContext, db_service: &DatabaseService) -> Result<GraphQLValue, GraphQLError> {
    let _user_id = ctx.field_info.arguments
        .get("userId")
        .and_then(|v| v.as_str())
        .ok_or_else(|| GraphQLError::new("Missing required argument 'userId'"))?;

    // Mock implementation
    Ok(GraphQLValue::Boolean(true))
}

pub fn block_user_resolver(ctx: &FieldContext, db_service: &DatabaseService) -> Result<GraphQLValue, GraphQLError> {
    let _user_id = ctx.field_info.arguments
        .get("userId")
        .and_then(|v| v.as_str())
        .ok_or_else(|| GraphQLError::new("Missing required argument 'userId'"))?;

    // Mock implementation
    Ok(GraphQLValue::Boolean(true))
}

pub fn unblock_user_resolver(ctx: &FieldContext, db_service: &DatabaseService) -> Result<GraphQLValue, GraphQLError> {
    let _user_id = ctx.field_info.arguments
        .get("userId")
        .and_then(|v| v.as_str())
        .ok_or_else(|| GraphQLError::new("Missing required argument 'userId'"))?;

    // Mock implementation
    Ok(GraphQLValue::Boolean(true))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_profile_to_graphql_value() {
        let profile_json = serde_json::json!({
            "id": "profile_123",
            "user_id": "user_456",
            "username": "testuser",
            "bio": "Test bio",
            "is_private": 0,
            "verified_type": null
        });

        let graphql_value = profile_to_graphql_value(&profile_json);
        
        if let GraphQLValue::Object(obj) = graphql_value {
            assert_eq!(obj.get("id"), Some(&GraphQLValue::String("profile_123".to_string())));
            assert_eq!(obj.get("userId"), Some(&GraphQLValue::String("user_456".to_string())));
            assert_eq!(obj.get("username"), Some(&GraphQLValue::String("testuser".to_string())));
            assert_eq!(obj.get("isPrivate"), Some(&GraphQLValue::Boolean(false)));
        } else {
            panic!("Expected GraphQLValue::Object");
        }
    }

    #[test]
    fn test_user_to_graphql_value() {
        let user_json = serde_json::json!({
            "id": "user_123",
            "email": "test@example.com",
            "email_verified": 1,
            "phone": null,
            "phone_verified": 0
        });

        let graphql_value = user_to_graphql_value(&user_json);
        
        if let GraphQLValue::Object(obj) = graphql_value {
            assert_eq!(obj.get("id"), Some(&GraphQLValue::String("user_123".to_string())));
            assert_eq!(obj.get("email"), Some(&GraphQLValue::String("test@example.com".to_string())));
            assert_eq!(obj.get("emailVerified"), Some(&GraphQLValue::Boolean(true)));
            assert_eq!(obj.get("phoneVerified"), Some(&GraphQLValue::Boolean(false)));
        } else {
            panic!("Expected GraphQLValue::Object");
        }
    }
}