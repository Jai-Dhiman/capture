use crate::db::DbConnection;
use serde::{Deserialize, Serialize};
use worker::*;

#[derive(Debug, Serialize, Deserialize)]
pub struct User {
    pub id: String,
    pub email: String,
    pub verified: i32,
    pub verification_expires_at: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Profile {
    pub id: String,
    pub user_id: String,
    pub username: String,
    pub profile_image: Option<String>,
    pub bio: Option<String>,
    pub verified_type: String,
    pub is_private: i32,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct EmailCode {
    pub id: String,
    pub email: String,
    pub code: String,
    pub r#type: String,
    pub expires_at: String,
    pub used_at: Option<String>,
    pub created_at: String,
}

pub struct UserService;

impl UserService {
    /// Check if a user exists by email
    pub async fn user_exists_by_email(db: &DbConnection, email: &str) -> Result<bool> {
        let sql = "SELECT COUNT(*) as count FROM users WHERE email = ?";
        let count = db.count_with_params(sql, &[email.to_string()]).await?;
        Ok(count > 0)
    }

    /// Find user by email
    pub async fn find_user_by_email(db: &DbConnection, email: &str) -> Result<Option<User>> {
        let sql = "SELECT id, email, verified, verification_expires_at, created_at, updated_at FROM users WHERE email = ?";
        db.execute_with_params(sql, &[email.to_string()]).await
    }

    /// Find user by ID
    pub async fn find_user_by_id(db: &DbConnection, user_id: &str) -> Result<Option<User>> {
        let sql = "SELECT id, email, verified, verification_expires_at, created_at, updated_at FROM users WHERE id = ?";
        db.execute_with_params(sql, &[user_id.to_string()]).await
    }

    /// Create a new user
    pub async fn create_user(
        db: &DbConnection,
        id: &str,
        email: &str,
        verified: i32,
        verification_expires_at: Option<&str>,
    ) -> Result<()> {
        let now = chrono::Utc::now().to_rfc3339();

        let sql = "INSERT INTO users (id, email, verified, verification_expires_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)";
        let params = vec![
            id.to_string(),
            email.to_string(),
            verified.to_string(),
            verification_expires_at.unwrap_or("").to_string(),
            now.clone(),
            now,
        ];

        db.execute_modify_with_params(sql, &params).await?;
        Ok(())
    }

    /// Check if profile exists for user
    pub async fn profile_exists_for_user(db: &DbConnection, user_id: &str) -> Result<bool> {
        let sql = "SELECT COUNT(*) as count FROM profile WHERE user_id = ?";
        let count = db.count_with_params(sql, &[user_id.to_string()]).await?;
        Ok(count > 0)
    }

    /// Check if username is available
    pub async fn username_available(db: &DbConnection, username: &str) -> Result<bool> {
        let sql = "SELECT COUNT(*) as count FROM profile WHERE username = ?";
        let count = db.count_with_params(sql, &[username.to_string()]).await?;
        Ok(count == 0)
    }

    /// Create email verification code
    pub async fn create_email_code(
        db: &DbConnection,
        id: &str,
        email: &str,
        code: &str,
        code_type: &str,
        expires_at: &str,
    ) -> Result<()> {
        let now = chrono::Utc::now().to_rfc3339();

        let sql = "INSERT INTO email_codes (id, email, code, type, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?)";
        let params = vec![
            id.to_string(),
            email.to_string(),
            code.to_string(),
            code_type.to_string(),
            expires_at.to_string(),
            now,
        ];

        db.execute_modify_with_params(sql, &params).await?;
        Ok(())
    }

    /// Find valid email code
    pub async fn find_valid_email_code(
        db: &DbConnection,
        email: &str,
        code: &str,
        current_time: &str,
    ) -> Result<Option<EmailCode>> {
        let sql = "SELECT id, email, code, type, expires_at, used_at, created_at FROM email_codes WHERE email = ? AND code = ? AND expires_at > ? AND used_at IS NULL ORDER BY created_at DESC LIMIT 1";
        let params = vec![
            email.to_string(),
            code.to_string(),
            current_time.to_string(),
        ];

        db.execute_with_params(sql, &params).await
    }

    /// Mark email code as used
    pub async fn mark_email_code_used(db: &DbConnection, code_id: &str) -> Result<()> {
        let now = chrono::Utc::now().to_rfc3339();

        let sql = "UPDATE email_codes SET used_at = ? WHERE id = ?";
        let params = vec![now, code_id.to_string()];

        db.execute_modify_with_params(sql, &params).await?;
        Ok(())
    }

    /// Update user verification status
    pub async fn update_user_verification(
        db: &DbConnection,
        user_id: &str,
        verified: i32,
    ) -> Result<()> {
        let now = chrono::Utc::now().to_rfc3339();

        let sql = "UPDATE users SET verified = ?, updated_at = ? WHERE id = ?";
        let params = vec![verified.to_string(), now, user_id.to_string()];

        db.execute_modify_with_params(sql, &params).await?;
        Ok(())
    }

    /// Clean up expired email codes
    pub async fn cleanup_expired_codes(db: &DbConnection, current_time: &str) -> Result<u32> {
        let sql = "DELETE FROM email_codes WHERE expires_at < ?";
        let _result = db
            .execute_modify_with_params(sql, &[current_time.to_string()])
            .await?;
        // Note: D1Result doesn't expose changes count, so we return 0 for now
        Ok(0)
    }

    /// Get user's followers count
    pub async fn get_followers_count(db: &DbConnection, user_id: &str) -> Result<i64> {
        let sql = "SELECT COUNT(*) as count FROM relationship WHERE followed_id = ?";
        db.count_with_params(sql, &[user_id.to_string()]).await
    }

    /// Get user's following count
    pub async fn get_following_count(db: &DbConnection, user_id: &str) -> Result<i64> {
        let sql = "SELECT COUNT(*) as count FROM relationship WHERE follower_id = ?";
        db.count_with_params(sql, &[user_id.to_string()]).await
    }

    /// Check if user A follows user B
    pub async fn is_following(
        db: &DbConnection,
        follower_id: &str,
        followed_id: &str,
    ) -> Result<bool> {
        let sql =
            "SELECT COUNT(*) as count FROM relationship WHERE follower_id = ? AND followed_id = ?";
        let params = vec![follower_id.to_string(), followed_id.to_string()];
        let count = db.count_with_params(sql, &params).await?;
        Ok(count > 0)
    }

    /// Check if user A is blocked by user B
    pub async fn is_blocked(
        db: &DbConnection,
        user_id: &str,
        blocked_by_user_id: &str,
    ) -> Result<bool> {
        let sql =
            "SELECT COUNT(*) as count FROM blocked_user WHERE blocked_id = ? AND blocker_id = ?";
        let params = vec![user_id.to_string(), blocked_by_user_id.to_string()];
        let count = db.count_with_params(sql, &params).await?;
        Ok(count > 0)
    }
}
