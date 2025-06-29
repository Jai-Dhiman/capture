use crate::graphql::schema::{GraphQLContext, Profile};
use serde_json;
use worker::*;

pub async fn resolve_profile(id: &str, ctx: &GraphQLContext) -> Result<serde_json::Value> {
    let profile = get_profile(ctx, id.to_string()).await?;

    match profile {
        Some(profile) => {
            console_log!("Found profile: {:?}", profile);
            Ok(serde_json::to_value(profile)?)
        }
        None => {
            console_log!("Profile not found for id: {}", id);
            Ok(serde_json::Value::Null)
        }
    }
}

async fn get_profile(ctx: &GraphQLContext, id: String) -> worker::Result<Option<Profile>> {
    let db = ctx.env.d1("DB")?;

    // Query the profile table using the actual column names (snake_case)
    let stmt = db.prepare("SELECT * FROM profile WHERE id = ?");
    let result = stmt
        .bind(&[id.into()])?
        .first::<serde_json::Value>(None)
        .await?;

    if let Some(row) = result {
        // Convert user_id from serde_json::Value to worker::Value for database queries
        let user_id_value = row["user_id"]
            .as_str()
            .ok_or_else(|| worker::Error::from("user_id field is not a string"))?;

        // Get follower/following counts from relationship table
        let followers_stmt =
            db.prepare("SELECT COUNT(*) as count FROM relationship WHERE followed_id = ?");
        let followers_result = followers_stmt
            .bind(&[user_id_value.into()])?
            .first::<serde_json::Value>(None)
            .await?;

        let following_stmt =
            db.prepare("SELECT COUNT(*) as count FROM relationship WHERE follower_id = ?");
        let following_result = following_stmt
            .bind(&[user_id_value.into()])?
            .first::<serde_json::Value>(None)
            .await?;

        let followers_count = followers_result
            .and_then(|r| r["count"].as_i64())
            .unwrap_or(0) as i32;
        let following_count = following_result
            .and_then(|r| r["count"].as_i64())
            .unwrap_or(0) as i32;

        // Map database fields (snake_case) to Profile struct
        let profile = Profile {
            id: row["id"].as_str().unwrap_or_default().to_string(),
            user_id: row["user_id"].as_str().unwrap_or_default().to_string(),
            username: row["username"].as_str().unwrap_or_default().to_string(),
            profile_image: row["profile_image"].as_str().map(|s| s.to_string()),
            bio: row["bio"].as_str().map(|s| s.to_string()),
            verified_type: row["verified_type"].as_str().unwrap_or("none").to_string(),
            is_private: row["is_private"].as_i64().unwrap_or(0) == 1,
            followers_count,
            following_count,
            created_at: row["created_at"].as_str().unwrap_or_default().to_string(),
            updated_at: row["updated_at"].as_str().unwrap_or_default().to_string(),
            is_following: None,
            is_blocked: None,
        };

        Ok(Some(profile))
    } else {
        Ok(None)
    }
}
