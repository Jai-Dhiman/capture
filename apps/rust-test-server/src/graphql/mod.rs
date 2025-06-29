pub mod resolvers;
pub mod schema;

use resolvers::resolve_query;
use schema::{GraphQLContext, GraphQLError, GraphQLRequest, GraphQLResponse, QueryOperation};
use worker::*;

// Simple GraphQL query parser
pub fn parse_query(query: &str) -> Result<QueryOperation> {
    let query = query.trim();

    // Parse basic queries using simple pattern matching
    if query.contains("hello") {
        return Ok(QueryOperation::Hello);
    }

    if query.contains("status") {
        return Ok(QueryOperation::Status);
    }

    // Parse profile query: profile(id: "123")
    if query.contains("profile") {
        // Simple regex-like parsing for profile(id: "value")
        if let Some(start) = query.find("profile(") {
            if let Some(id_start) = query[start..].find("id:") {
                let id_section = &query[start + id_start + 3..];
                // Find the quoted ID value
                if let Some(quote_start) = id_section.find('"') {
                    if let Some(quote_end) = id_section[quote_start + 1..].find('"') {
                        let id =
                            id_section[quote_start + 1..quote_start + 1 + quote_end].to_string();
                        return Ok(QueryOperation::Profile { id });
                    }
                }
            }
        }
        return Err("Invalid profile query format".into());
    }

    Err("Unsupported query".into())
}

// Main GraphQL handler
pub async fn handle_graphql_request(
    body: String,
    env: Env,
    user_id: Option<String>,
) -> Result<Response> {
    // Parse the GraphQL request
    let graphql_request: GraphQLRequest = match serde_json::from_str(&body) {
        Ok(req) => req,
        Err(e) => {
            console_log!("Failed to parse GraphQL request: {:?}", e);
            let response = GraphQLResponse {
                data: None,
                errors: Some(vec![GraphQLError {
                    message: "Invalid GraphQL request".to_string(),
                    path: None,
                }]),
            };
            return Response::from_json(&response);
        }
    };

    console_log!("GraphQL Query: {}", graphql_request.query);

    // Parse the query
    let operation = match parse_query(&graphql_request.query) {
        Ok(op) => op,
        Err(e) => {
            console_log!("Failed to parse query: {:?}", e);
            let response = GraphQLResponse {
                data: None,
                errors: Some(vec![GraphQLError {
                    message: format!("Query parsing error: {}", e),
                    path: None,
                }]),
            };
            return Response::from_json(&response);
        }
    };

    // Create context and resolve the query
    let ctx = GraphQLContext::new(env, user_id);

    match resolve_query(operation, &ctx).await {
        Ok(data) => {
            let response = GraphQLResponse {
                data: Some(data),
                errors: None,
            };
            Response::from_json(&response)
        }
        Err(e) => {
            console_log!("Query resolution error: {:?}", e);
            let response = GraphQLResponse {
                data: None,
                errors: Some(vec![GraphQLError {
                    message: format!("Resolution error: {}", e),
                    path: None,
                }]),
            };
            Response::from_json(&response)
        }
    }
}
