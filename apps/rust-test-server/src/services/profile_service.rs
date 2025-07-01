use crate::graphql::client::{extract_auth_token, GraphQLClient};
use crate::graphql::queries::*;
use crate::graphql::types::{ApiResponse, ProfileData};
use serde_json::json;
use worker::*;

pub struct ProfileService {
    graphql_client: GraphQLClient,
}

impl ProfileService {
    pub fn new(graphql_endpoint: String) -> Self {
        Self {
            graphql_client: GraphQLClient::new(graphql_endpoint),
        }
    }

    // Get profile by user ID
    pub async fn get_profile(
        &self,
        user_id: String,
        auth_token: Option<&str>,
    ) -> Result<ApiResponse<ProfileData>> {
        let variables = get_profile::Variables { user_id };

        match self
            .graphql_client
            .query::<GetProfile>(variables, auth_token)
            .await
        {
            Ok(response) => {
                if let Some(errors) = response.errors {
                    let error_msg = errors
                        .into_iter()
                        .map(|e| e.message)
                        .collect::<Vec<_>>()
                        .join(", ");
                    return Ok(ApiResponse::error(error_msg));
                }

                if let Some(data) = response.data {
                    if let Some(profile) = data.profile {
                        return Ok(ApiResponse::success(ProfileData::from(profile)));
                    }
                }

                Ok(ApiResponse::error("Profile not found".to_string()))
            }
            Err(e) => Ok(ApiResponse::error(format!("GraphQL request failed: {}", e))),
        }
    }

    // Search users by query string
    pub async fn search_users(
        &self,
        query: String,
        auth_token: Option<&str>,
    ) -> Result<ApiResponse<Vec<ProfileData>>> {
        let variables = search_users::Variables { query };

        match self
            .graphql_client
            .query::<SearchUsers>(variables, auth_token)
            .await
        {
            Ok(response) => {
                if let Some(errors) = response.errors {
                    let error_msg = errors
                        .into_iter()
                        .map(|e| e.message)
                        .collect::<Vec<_>>()
                        .join(", ");
                    return Ok(ApiResponse::error(error_msg));
                }

                if let Some(data) = response.data {
                    let profiles: Vec<ProfileData> = data
                        .search_users
                        .into_iter()
                        .map(ProfileData::from)
                        .collect();
                    return Ok(ApiResponse::success(profiles));
                }

                Ok(ApiResponse::success(vec![]))
            }
            Err(e) => Ok(ApiResponse::error(format!("GraphQL request failed: {}", e))),
        }
    }

    // Get followers for a user
    pub async fn get_followers(
        &self,
        user_id: String,
        auth_token: Option<&str>,
    ) -> Result<ApiResponse<Vec<ProfileData>>> {
        let variables = get_followers::Variables { user_id };

        match self
            .graphql_client
            .query::<GetFollowers>(variables, auth_token)
            .await
        {
            Ok(response) => {
                if let Some(errors) = response.errors {
                    let error_msg = errors
                        .into_iter()
                        .map(|e| e.message)
                        .collect::<Vec<_>>()
                        .join(", ");
                    return Ok(ApiResponse::error(error_msg));
                }

                if let Some(data) = response.data {
                    let profiles: Vec<ProfileData> = data
                        .followers
                        .into_iter()
                        .map(|p| ProfileData {
                            id: p.id,
                            user_id: p.user_id,
                            username: p.username,
                            bio: p.bio,
                            profile_image: p.profile_image,
                            followers_count: p.followers_count,
                            following_count: p.following_count,
                            is_following: p.is_following,
                            is_private: p.is_private,
                            verified_type: p.verified_type,
                            created_at: "".to_string(),
                            updated_at: "".to_string(),
                            is_blocked: None,
                        })
                        .collect();
                    return Ok(ApiResponse::success(profiles));
                }

                Ok(ApiResponse::success(vec![]))
            }
            Err(e) => Ok(ApiResponse::error(format!("GraphQL request failed: {}", e))),
        }
    }

    // Get following for a user
    pub async fn get_following(
        &self,
        user_id: String,
        auth_token: Option<&str>,
    ) -> Result<ApiResponse<Vec<ProfileData>>> {
        let variables = get_following::Variables { user_id };

        match self
            .graphql_client
            .query::<GetFollowing>(variables, auth_token)
            .await
        {
            Ok(response) => {
                if let Some(errors) = response.errors {
                    let error_msg = errors
                        .into_iter()
                        .map(|e| e.message)
                        .collect::<Vec<_>>()
                        .join(", ");
                    return Ok(ApiResponse::error(error_msg));
                }

                if let Some(data) = response.data {
                    let profiles: Vec<ProfileData> = data
                        .following
                        .into_iter()
                        .map(|p| ProfileData {
                            id: p.id,
                            user_id: p.user_id,
                            username: p.username,
                            bio: p.bio,
                            profile_image: p.profile_image,
                            followers_count: p.followers_count,
                            following_count: p.following_count,
                            is_following: p.is_following,
                            is_private: p.is_private,
                            verified_type: p.verified_type,
                            created_at: "".to_string(),
                            updated_at: "".to_string(),
                            is_blocked: None,
                        })
                        .collect();
                    return Ok(ApiResponse::success(profiles));
                }

                Ok(ApiResponse::success(vec![]))
            }
            Err(e) => Ok(ApiResponse::error(format!("GraphQL request failed: {}", e))),
        }
    }

    // Update profile
    pub async fn update_profile(
        &self,
        input: update_profile::ProfileInput,
        auth_token: Option<&str>,
    ) -> Result<ApiResponse<ProfileData>> {
        let variables = update_profile::Variables { input };

        match self
            .graphql_client
            .mutate::<UpdateProfile>(variables, auth_token)
            .await
        {
            Ok(response) => {
                if let Some(errors) = response.errors {
                    let error_msg = errors
                        .into_iter()
                        .map(|e| e.message)
                        .collect::<Vec<_>>()
                        .join(", ");
                    return Ok(ApiResponse::error(error_msg));
                }

                if let Some(data) = response.data {
                    let profile = ProfileData {
                        id: data.update_profile.id,
                        user_id: data.update_profile.user_id,
                        username: data.update_profile.username,
                        bio: data.update_profile.bio,
                        profile_image: data.update_profile.profile_image,
                        followers_count: data.update_profile.followers_count,
                        following_count: data.update_profile.following_count,
                        is_following: data.update_profile.is_following,
                        is_private: data.update_profile.is_private,
                        verified_type: data.update_profile.verified_type,
                        created_at: data.update_profile.created_at,
                        updated_at: data.update_profile.updated_at,
                        is_blocked: None,
                    };
                    return Ok(ApiResponse::success(profile));
                }

                Ok(ApiResponse::error("Failed to update profile".to_string()))
            }
            Err(e) => Ok(ApiResponse::error(format!("GraphQL request failed: {}", e))),
        }
    }

    // Follow user
    pub async fn follow_user(
        &self,
        user_id: String,
        auth_token: Option<&str>,
    ) -> Result<ApiResponse<serde_json::Value>> {
        let variables = follow_user::Variables { user_id };

        match self
            .graphql_client
            .mutate::<FollowUser>(variables, auth_token)
            .await
        {
            Ok(response) => {
                if let Some(errors) = response.errors {
                    let error_msg = errors
                        .into_iter()
                        .map(|e| e.message)
                        .collect::<Vec<_>>()
                        .join(", ");
                    return Ok(ApiResponse::error(error_msg));
                }

                if let Some(data) = response.data {
                    let result = json!({
                        "success": data.follow_user.success,
                        "relationship": data.follow_user.relationship.map(|r| json!({
                            "id": r.id,
                            "followerId": r.follower_id,
                            "followedId": r.followed_id,
                            "createdAt": r.created_at
                        }))
                    });
                    return Ok(ApiResponse::success(result));
                }

                Ok(ApiResponse::error("Failed to follow user".to_string()))
            }
            Err(e) => Ok(ApiResponse::error(format!("GraphQL request failed: {}", e))),
        }
    }

    // Unfollow user
    pub async fn unfollow_user(
        &self,
        user_id: String,
        auth_token: Option<&str>,
    ) -> Result<ApiResponse<serde_json::Value>> {
        let variables = unfollow_user::Variables { user_id };

        match self
            .graphql_client
            .mutate::<UnfollowUser>(variables, auth_token)
            .await
        {
            Ok(response) => {
                if let Some(errors) = response.errors {
                    let error_msg = errors
                        .into_iter()
                        .map(|e| e.message)
                        .collect::<Vec<_>>()
                        .join(", ");
                    return Ok(ApiResponse::error(error_msg));
                }

                if let Some(data) = response.data {
                    let result = json!({
                        "success": data.unfollow_user.success
                    });
                    return Ok(ApiResponse::success(result));
                }

                Ok(ApiResponse::error("Failed to unfollow user".to_string()))
            }
            Err(e) => Ok(ApiResponse::error(format!("GraphQL request failed: {}", e))),
        }
    }
}