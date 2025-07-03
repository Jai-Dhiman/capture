use serde_json::json;
use worker::*;

pub mod db;
mod entities;
pub mod graphql;
mod middleware;
mod routes;
mod services;

use routes::auth::AuthRoutes;
use routes::graphql::GraphQLRoutes;
use routes::profile::ProfileRoutes;

#[event(fetch)]
pub async fn main(req: Request, env: Env, _ctx: worker::Context) -> Result<Response> {
    let router = Router::new();

    router
        .get_async("/", |_req, ctx| async move {
            // Get the D1 database binding from the environment
            let db = match ctx.env.d1("DB") {
                Ok(database) => database,
                Err(_) => {
                    let response = Response::from_json(&json!({
                        "status": "degraded",
                        "timestamp": chrono::Utc::now().to_rfc3339(),
                        "database": "error",
                        "error": "Failed to get database binding"
                    }))?;
                    return Ok(response.with_status(500));
                }
            };

            // Try to query the profile table to check database connectivity
            let query_result = db
                .prepare("SELECT COUNT(*) as count FROM profile LIMIT 1")
                .bind(&[])?
                .first::<serde_json::Value>(None)
                .await;

            match query_result {
                Ok(Some(result)) => {
                    let count = result.get("count").and_then(|v| v.as_i64()).unwrap_or(0);
                    Response::from_json(&json!({
                        "status": "ok",
                        "timestamp": chrono::Utc::now().to_rfc3339(),
                        "database": "connected",
                        "db_check": if count > 0 { "records exist" } else { "no records" }
                    }))
                }
                Ok(None) => Response::from_json(&json!({
                    "status": "ok",
                    "timestamp": chrono::Utc::now().to_rfc3339(),
                    "database": "connected",
                    "db_check": "no records"
                })),
                Err(e) => {
                    console_log!("Database health check failed: {:?}", e);
                    let response = Response::from_json(&json!({
                        "status": "degraded",
                        "timestamp": chrono::Utc::now().to_rfc3339(),
                        "database": "error",
                        "error": format!("Database query failed: {}", e)
                    }))?;
                    Ok(response.with_status(500))
                }
            }
        })
        // Authentication routes
        .get_async("/auth/me", AuthRoutes::get_me)
        .post_async("/auth/send-code", AuthRoutes::send_code)
        .post_async("/auth/verify-code", AuthRoutes::verify_code)
        .post_async("/auth/refresh", AuthRoutes::refresh)
        .post_async("/auth/logout", AuthRoutes::logout)
        // OAuth routes
        .post_async("/auth/oauth/google", AuthRoutes::oauth_google)
        .post_async("/auth/oauth/google/token", AuthRoutes::oauth_google_token)
        .post_async("/auth/oauth/apple", AuthRoutes::oauth_apple)
        // Passkey routes
        .post_async("/auth/passkey/check", AuthRoutes::passkey_check)
        .post_async(
            "/auth/passkey/register/begin",
            AuthRoutes::passkey_register_begin,
        )
        .post_async(
            "/auth/passkey/register/complete",
            AuthRoutes::passkey_register_complete,
        )
        .post_async(
            "/auth/passkey/authenticate/begin",
            AuthRoutes::passkey_authenticate_begin,
        )
        .post_async(
            "/auth/passkey/authenticate/complete",
            AuthRoutes::passkey_authenticate_complete,
        )
        .get_async("/auth/passkey/list", AuthRoutes::passkey_list)
        .delete_async("/auth/passkey/:passkeyId", AuthRoutes::passkey_delete)
        // GraphQL routes
        .post_async("/graphql", GraphQLRoutes::handle_graphql)
        // Profile routes
        .get_async(
            "/profile/check-username",
            ProfileRoutes::check_username_availability,
        )
        .post_async("/profile", ProfileRoutes::create_profile)
        .delete_async("/profile/:userId", ProfileRoutes::delete_profile)
        .run(req, env)
        .await
}
