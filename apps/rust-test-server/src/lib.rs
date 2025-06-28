use serde_json::json;
use worker::*;

#[event(fetch)]
pub async fn main(req: Request, env: Env, _ctx: worker::Context) -> Result<Response> {
    let router = Router::new();
    
    router
        .get("/", |_, _| Response::ok("Rust Test Server is running!"))
        .get_async("/health", |_req, ctx| async move {
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
                },
                Ok(None) => {
                    Response::from_json(&json!({
                        "status": "ok",
                        "timestamp": chrono::Utc::now().to_rfc3339(),
                        "database": "connected",
                        "db_check": "no records"
                    }))
                },
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
        .run(req, env)
        .await
}


