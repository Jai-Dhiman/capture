use worker::*;
use crate::graphql::{
    GraphQLRequest, GraphQLResponse, GraphQLExecutor, GraphQLSchema, ObjectType, 
    Field as SchemaField, ScalarType, GraphQLType, GraphQLValue, GraphQLError
};

pub struct GraphQLRoutes;

impl GraphQLRoutes {
    pub async fn handle_graphql(mut req: Request, _ctx: RouteContext<()>) -> Result<Response> {
        // Only accept POST requests for GraphQL
        if req.method() != Method::Post {
            return Response::error("GraphQL endpoint only accepts POST requests", 405);
        }

        // Parse the GraphQL request
        let graphql_request: GraphQLRequest = match req.json().await {
            Ok(request) => request,
            Err(_) => {
                let error_response = GraphQLResponse::error(
                    GraphQLError::new("Invalid JSON in request body")
                );
                return Response::from_json(&error_response);
            }
        };

        // Create a basic schema with health check
        let executor = Self::create_health_check_executor();

        // Execute the GraphQL query
        let response = executor.execute(graphql_request);

        Response::from_json(&response)
    }

    fn create_health_check_executor() -> GraphQLExecutor {
        // Create a basic schema with health check query
        let query_type = ObjectType::new("Query")
            .add_field("health", SchemaField::new(GraphQLType::Object(
                ObjectType::new("Health")
                    .add_field("status", SchemaField::new(GraphQLType::Scalar(ScalarType::string())))
                    .add_field("timestamp", SchemaField::new(GraphQLType::Scalar(ScalarType::string())))
                    .add_field("service", SchemaField::new(GraphQLType::Scalar(ScalarType::string())))
                    .add_field("version", SchemaField::new(GraphQLType::Scalar(ScalarType::string())))
            )))
            .add_field("ping", SchemaField::new(GraphQLType::Scalar(ScalarType::string())));

        let schema = GraphQLSchema::new(query_type);
        let mut executor = GraphQLExecutor::new(schema);

        // Add resolver for health field
        executor.add_resolver("Query", "health", |_ctx| {
            Ok(GraphQLValue::Object([
                ("status".to_string(), GraphQLValue::String("ok".to_string())),
                ("timestamp".to_string(), GraphQLValue::String(chrono::Utc::now().to_rfc3339())),
                ("service".to_string(), GraphQLValue::String("rust-test-server".to_string())),
                ("version".to_string(), GraphQLValue::String("0.1.0".to_string())),
            ].iter().cloned().collect()))
        });

        // Add resolver for ping field
        executor.add_resolver("Query", "ping", |_ctx| {
            Ok(GraphQLValue::String("pong".to_string()))
        });

        // Add resolvers for Health type fields
        executor.add_resolver("Health", "status", |ctx| {
            if let Some(parent) = &ctx.parent {
                if let Some(status) = parent.get("status") {
                    Ok(GraphQLValue::String(status.as_str().unwrap_or("unknown").to_string()))
                } else {
                    Ok(GraphQLValue::String("unknown".to_string()))
                }
            } else {
                Ok(GraphQLValue::String("unknown".to_string()))
            }
        });

        executor.add_resolver("Health", "timestamp", |ctx| {
            if let Some(parent) = &ctx.parent {
                if let Some(timestamp) = parent.get("timestamp") {
                    Ok(GraphQLValue::String(timestamp.as_str().unwrap_or("").to_string()))
                } else {
                    Ok(GraphQLValue::String(chrono::Utc::now().to_rfc3339()))
                }
            } else {
                Ok(GraphQLValue::String(chrono::Utc::now().to_rfc3339()))
            }
        });

        executor.add_resolver("Health", "service", |ctx| {
            if let Some(parent) = &ctx.parent {
                if let Some(service) = parent.get("service") {
                    Ok(GraphQLValue::String(service.as_str().unwrap_or("").to_string()))
                } else {
                    Ok(GraphQLValue::String("rust-test-server".to_string()))
                }
            } else {
                Ok(GraphQLValue::String("rust-test-server".to_string()))
            }
        });

        executor.add_resolver("Health", "version", |ctx| {
            if let Some(parent) = &ctx.parent {
                if let Some(version) = parent.get("version") {
                    Ok(GraphQLValue::String(version.as_str().unwrap_or("").to_string()))
                } else {
                    Ok(GraphQLValue::String("0.1.0".to_string()))
                }
            } else {
                Ok(GraphQLValue::String("0.1.0".to_string()))
            }
        });

        executor
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn test_health_check_query() {
        let executor = GraphQLRoutes::create_health_check_executor();
        let request = GraphQLRequest {
            query: "{ health { status timestamp service version } }".to_string(),
            variables: None,
            operation_name: None,
        };

        let response = executor.execute(request);
        
        if let Some(errors) = &response.errors {
            println!("GraphQL errors: {:?}", errors);
        }
        
        assert!(response.errors.is_none(), "Expected no errors, got: {:?}", response.errors);
        assert!(response.data.is_some());

        let data = response.data.unwrap();
        let health = &data["health"];
        assert_eq!(health["status"], json!("ok"));
        assert_eq!(health["service"], json!("rust-test-server"));
        assert_eq!(health["version"], json!("0.1.0"));
        assert!(health["timestamp"].is_string());
    }

    #[test]
    fn test_ping_query() {
        let executor = GraphQLRoutes::create_health_check_executor();
        let request = GraphQLRequest {
            query: "{ ping }".to_string(),
            variables: None,
            operation_name: None,
        };

        let response = executor.execute(request);
        assert!(response.errors.is_none());
        assert!(response.data.is_some());

        let data = response.data.unwrap();
        assert_eq!(data["ping"], json!("pong"));
    }

    #[test]
    fn test_combined_query() {
        let executor = GraphQLRoutes::create_health_check_executor();
        let request = GraphQLRequest {
            query: "{ ping health { status service } }".to_string(),
            variables: None,
            operation_name: None,
        };

        let response = executor.execute(request);
        
        if let Some(errors) = &response.errors {
            println!("GraphQL errors: {:?}", errors);
        }
        
        assert!(response.errors.is_none(), "Expected no errors, got: {:?}", response.errors);
        assert!(response.data.is_some());

        let data = response.data.unwrap();
        assert_eq!(data["ping"], json!("pong"));
        assert_eq!(data["health"]["status"], json!("ok"));
        assert_eq!(data["health"]["service"], json!("rust-test-server"));
    }
}