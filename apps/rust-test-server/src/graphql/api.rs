/*!
# GraphQL API - High-Level Interface

This module provides a high-level, easy-to-use API for GraphQL query parsing, validation, and execution.
It abstracts away the complexity of the underlying components and provides simple functions for common use cases.

## Quick Start

```rust
use crate::graphql::api::*;
use serde_json::json;

// Create a simple schema
let schema = create_simple_schema();

// Execute a GraphQL query
let result = execute_query_simple(
    "{ hello }",
    None,
    &schema
);

match result {
    Ok(response) => println!("Data: {:?}", response.data),
    Err(error) => println!("Error: {}", error),
}
```

## Advanced Usage

```rust
use crate::graphql::api::*;

// Create a GraphQL engine with custom configuration
let mut engine = GraphQLEngine::new(schema)
    .with_validation(true)
    .with_error_collection(true)
    .with_enhanced_errors(true);

// Add custom resolvers
engine.add_resolver("Query", "hello", |_| {
    Ok(GraphQLValue::String("Hello, World!".to_string()))
});

// Execute queries
let response = engine.execute_query("{ hello }", None, None)?;
```
*/

use crate::graphql::{
    schema::{Field, ObjectType, ScalarType},
    FieldContext, GraphQLError, GraphQLRequest, GraphQLResponse, GraphQLSchema, GraphQLValue,
    QueryExecutor, ResolverRegistry, ResultFormatter, SyncFieldResolver,
};
use serde_json::Value;
use std::collections::HashMap;

/// High-level GraphQL execution engine that provides a simple API for query execution
pub struct GraphQLEngine {
    executor: QueryExecutor,
}

impl GraphQLEngine {
    /// Create a new GraphQL engine with the given schema
    pub fn new(schema: GraphQLSchema) -> Self {
        Self {
            executor: QueryExecutor::new(schema),
        }
    }

    /// Create a GraphQL engine with custom resolver registry
    pub fn with_resolver_registry(
        schema: GraphQLSchema,
        resolver_registry: ResolverRegistry,
    ) -> Self {
        Self {
            executor: QueryExecutor::with_resolver_registry(schema, resolver_registry),
        }
    }

    /// Enable or disable query validation
    pub fn with_validation(mut self, enabled: bool) -> Self {
        self.executor.set_validation_enabled(enabled);
        self
    }

    /// Enable or disable error collection (vs fail-fast)
    pub fn with_error_collection(mut self, enabled: bool) -> Self {
        self.executor.set_error_collection_enabled(enabled);
        self
    }

    /// Enable or disable enhanced error formatting
    pub fn with_enhanced_errors(mut self, enabled: bool) -> Self {
        self.executor.set_enhanced_errors(enabled);
        self
    }

    /// Enable or disable response extensions
    pub fn with_extensions(mut self, enabled: bool) -> Self {
        self.executor.set_extensions_enabled(enabled);
        self
    }

    /// Add a synchronous field resolver
    pub fn add_resolver<F>(&mut self, type_name: &str, field_name: &str, resolver: F) -> &mut Self
    where
        F: Fn(&FieldContext) -> Result<GraphQLValue, GraphQLError> + Send + Sync + 'static,
    {
        self.executor
            .resolver_registry_mut()
            .add_sync_resolver(type_name, field_name, resolver);
        self
    }

    /// Execute a GraphQL query string
    pub fn execute_query(
        &self,
        query: &str,
        variables: Option<Value>,
        operation_name: Option<String>,
    ) -> Result<GraphQLResponse, GraphQLError> {
        let request = GraphQLRequest {
            query: query.to_string(),
            variables,
            operation_name,
        };

        Ok(self.executor.execute(request))
    }

    /// Execute a GraphQL query with optimizations enabled
    pub fn execute_query_optimized(
        &self,
        query: &str,
        variables: Option<Value>,
        operation_name: Option<String>,
    ) -> Result<GraphQLResponse, GraphQLError> {
        let request = GraphQLRequest {
            query: query.to_string(),
            variables,
            operation_name,
        };

        Ok(self.executor.execute_optimized(request))
    }

    /// Execute a GraphQL query asynchronously (for future async resolver support)
    pub async fn execute_query_async(
        &self,
        query: &str,
        variables: Option<Value>,
        operation_name: Option<String>,
    ) -> Result<GraphQLResponse, GraphQLError> {
        let request = GraphQLRequest {
            query: query.to_string(),
            variables,
            operation_name,
        };

        Ok(self.executor.execute_async(request).await)
    }

    /// Execute a GraphQL request object
    pub fn execute_request(&self, request: GraphQLRequest) -> GraphQLResponse {
        self.executor.execute(request)
    }

    /// Get a mutable reference to the resolver registry for advanced customization
    pub fn resolver_registry_mut(&mut self) -> &mut ResolverRegistry {
        self.executor.resolver_registry_mut()
    }
}

/// Simple function to execute a GraphQL query with minimal configuration
pub fn execute_query_simple(
    query: &str,
    variables: Option<Value>,
    schema: &GraphQLSchema,
) -> Result<GraphQLResponse, GraphQLError> {
    let executor = QueryExecutor::new(schema.clone());
    let request = GraphQLRequest {
        query: query.to_string(),
        variables,
        operation_name: None,
    };

    Ok(executor.execute(request))
}

/// Parse a GraphQL query string into an AST
pub fn parse_query(query: &str) -> Result<crate::graphql::Document, GraphQLError> {
    use crate::graphql::{CustomParser, Lexer};

    let lexer = Lexer::new(query);
    let mut parser = CustomParser::new(lexer)?;
    parser.parse()
}

/// Validate a GraphQL query against a schema
pub fn validate_query(query: &str, schema: &GraphQLSchema) -> Result<(), Vec<GraphQLError>> {
    use crate::graphql::{ExecutionContext, Validator};
    use std::rc::Rc;

    let document = parse_query(query).map_err(|e| vec![e])?;

    // Find the operation
    let operations: Vec<_> = document.operations().collect();
    if operations.is_empty() {
        return Err(vec![GraphQLError::new("No operations found in document")]);
    }

    let operation = operations[0].clone();
    let variables = HashMap::new();

    let execution_context = ExecutionContext::new(
        Rc::new(schema.clone()),
        Rc::new(document),
        Rc::new(operation),
        variables,
    )
    .map_err(|errors| {
        errors
            .into_iter()
            .map(|e| GraphQLError::new(format!("Context creation error: {:?}", e)))
            .collect::<Vec<_>>()
    })?;

    Validator::validate(schema, &execution_context.document)
}

/// Create a simple test schema for demonstration purposes
pub fn create_simple_schema() -> GraphQLSchema {
    let string_type = crate::graphql::GraphQLType::Scalar(ScalarType::string());
    let _int_type = crate::graphql::GraphQLType::Scalar(ScalarType::int());

    let query_type = ObjectType::new("Query")
        .add_field("hello", Field::new(string_type.clone()))
        .add_field("version", Field::new(string_type.clone()))
        .add_field("ping", Field::new(string_type.clone()));

    GraphQLSchema::new(query_type)
}

/// Create a demo schema with sample data for testing
pub fn create_demo_schema() -> GraphQLSchema {
    let string_type = crate::graphql::GraphQLType::Scalar(ScalarType::string());
    let int_type = crate::graphql::GraphQLType::Scalar(ScalarType::int());
    let boolean_type = crate::graphql::GraphQLType::Scalar(ScalarType::boolean());

    // User type
    let user_type = ObjectType::new("User")
        .add_field("id", Field::new(string_type.clone()))
        .add_field("name", Field::new(string_type.clone()))
        .add_field("email", Field::new(string_type.clone()))
        .add_field("age", Field::new(int_type.clone()))
        .add_field("active", Field::new(boolean_type.clone()));

    // Query type
    let query_type = ObjectType::new("Query")
        .add_field("hello", Field::new(string_type.clone()))
        .add_field("version", Field::new(string_type.clone()))
        .add_field(
            "user",
            Field::new(crate::graphql::GraphQLType::Object(user_type.clone())),
        )
        .add_field(
            "users",
            Field::new(crate::graphql::GraphQLType::List(Box::new(
                crate::graphql::GraphQLType::Object(user_type.clone()),
            ))),
        );

    let mut schema = GraphQLSchema::new(query_type);
    schema.add_type(
        "User".to_string(),
        crate::graphql::GraphQLType::Object(user_type),
    );
    schema
}

/// Create a GraphQL engine with demo resolvers for testing
pub fn create_demo_engine() -> GraphQLEngine {
    let schema = create_demo_schema();
    let mut engine = GraphQLEngine::new(schema)
        .with_validation(true)
        .with_enhanced_errors(true);

    // Add demo resolvers
    engine.add_resolver("Query", "hello", |_| {
        Ok(GraphQLValue::String("Hello, GraphQL World!".to_string()))
    });

    engine.add_resolver("Query", "version", |_| {
        Ok(GraphQLValue::String("1.0.0".to_string()))
    });

    engine.add_resolver("Query", "user", |_| {
        let mut user = HashMap::new();
        user.insert("id".to_string(), GraphQLValue::String("1".to_string()));
        user.insert(
            "name".to_string(),
            GraphQLValue::String("John Doe".to_string()),
        );
        user.insert(
            "email".to_string(),
            GraphQLValue::String("john@example.com".to_string()),
        );
        user.insert("age".to_string(), GraphQLValue::Int(30));
        user.insert("active".to_string(), GraphQLValue::Boolean(true));
        Ok(GraphQLValue::Object(user))
    });

    engine.add_resolver("Query", "users", |_| {
        let user1 = {
            let mut user = HashMap::new();
            user.insert("id".to_string(), GraphQLValue::String("1".to_string()));
            user.insert(
                "name".to_string(),
                GraphQLValue::String("John Doe".to_string()),
            );
            user.insert(
                "email".to_string(),
                GraphQLValue::String("john@example.com".to_string()),
            );
            user.insert("age".to_string(), GraphQLValue::Int(30));
            user.insert("active".to_string(), GraphQLValue::Boolean(true));
            GraphQLValue::Object(user)
        };

        let user2 = {
            let mut user = HashMap::new();
            user.insert("id".to_string(), GraphQLValue::String("2".to_string()));
            user.insert(
                "name".to_string(),
                GraphQLValue::String("Jane Smith".to_string()),
            );
            user.insert(
                "email".to_string(),
                GraphQLValue::String("jane@example.com".to_string()),
            );
            user.insert("age".to_string(), GraphQLValue::Int(25));
            user.insert("active".to_string(), GraphQLValue::Boolean(true));
            GraphQLValue::Object(user)
        };

        Ok(GraphQLValue::List(vec![user1, user2]))
    });

    engine
}

/// Utility functions for common operations
pub mod utils {
    use super::*;
    use crate::graphql::result_utils;

    /// Check if a GraphQL response is successful
    pub fn is_successful(response: &GraphQLResponse) -> bool {
        response.data.is_some() && response.errors.is_none()
    }

    /// Check if a GraphQL response has errors
    pub fn has_errors(response: &GraphQLResponse) -> bool {
        response.errors.is_some()
    }

    /// Extract data from a GraphQL response
    pub fn extract_data(response: GraphQLResponse) -> Option<Value> {
        response.data
    }

    /// Extract errors from a GraphQL response
    pub fn extract_errors(response: GraphQLResponse) -> Option<Vec<GraphQLError>> {
        response.errors
    }

    /// Format a GraphQL response as a pretty JSON string
    pub fn format_response_pretty(response: &GraphQLResponse) -> Result<String, serde_json::Error> {
        result_utils::format_response_as_json_string(response)
    }

    /// Create a GraphQL error with a message
    pub fn create_error(message: &str) -> GraphQLError {
        GraphQLError::new(message)
    }

    /// Create a GraphQL error with location information
    pub fn create_error_with_location(message: &str, line: u32, column: u32) -> GraphQLError {
        GraphQLError::new(message).with_location(line, column)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn test_simple_schema_creation() {
        let schema = create_simple_schema();
        assert_eq!(schema.query_type.name, "Query");
        assert!(schema.query_type.fields.contains_key("hello"));
    }

    #[test]
    fn test_demo_schema_creation() {
        let schema = create_demo_schema();
        assert_eq!(schema.query_type.name, "Query");
        assert!(schema.query_type.fields.contains_key("user"));
        assert!(schema.query_type.fields.contains_key("users"));
    }

    #[test]
    fn test_engine_creation() {
        let schema = create_simple_schema();
        let _engine = GraphQLEngine::new(schema)
            .with_validation(true)
            .with_enhanced_errors(true);

        // Engine should be created successfully
        assert!(true);
    }

    #[test]
    fn test_demo_engine_execution() {
        let engine = create_demo_engine();

        let response = engine.execute_query("{ hello }", None, None).unwrap();

        assert!(response.data.is_some());
        if let Some(data) = response.data {
            if let Some(hello) = data.get("hello") {
                assert_eq!(hello, &json!("Hello, GraphQL World!"));
            } else {
                panic!("Expected 'hello' field in response");
            }
        }
    }

    #[test]
    fn test_demo_engine_user_query() {
        let engine = create_demo_engine();

        let response = engine
            .execute_query("{ user { id name email } }", None, None)
            .unwrap();

        assert!(response.data.is_some());
        if let Some(data) = response.data {
            if let Some(user) = data.get("user") {
                assert!(user.get("id").is_some());
                assert!(user.get("name").is_some());
                assert!(user.get("email").is_some());
            } else {
                panic!("Expected 'user' field in response");
            }
        }
    }

    #[test]
    fn test_parse_query_function() {
        let result = parse_query("{ hello }");
        assert!(result.is_ok());

        let document = result.unwrap();
        assert_eq!(document.definitions.len(), 1);
    }

    #[test]
    fn test_validate_query_function() {
        let schema = create_simple_schema();
        let result = validate_query("{ hello }", &schema);
        assert!(result.is_ok());

        let invalid_result = validate_query("{ nonExistentField }", &schema);
        assert!(invalid_result.is_err());
    }

    #[test]
    fn test_utils_functions() {
        use utils::*;

        let successful_response = GraphQLResponse {
            data: Some(json!({"hello": "world"})),
            errors: None,
            extensions: None,
        };

        assert!(is_successful(&successful_response));
        assert!(!has_errors(&successful_response));

        let error_response = GraphQLResponse {
            data: None,
            errors: Some(vec![create_error("Test error")]),
            extensions: None,
        };

        assert!(!is_successful(&error_response));
        assert!(has_errors(&error_response));
    }

    #[test]
    fn test_execute_query_simple() {
        let schema = create_simple_schema();
        let result = execute_query_simple("{ hello }", None, &schema);

        assert!(result.is_ok());
        let response = result.unwrap();
        // Note: This will have errors since we haven't registered resolvers,
        // but the parsing and execution pipeline should work
        assert!(response.data.is_some() || response.errors.is_some());
    }

    #[test]
    fn test_optimized_execution() {
        let engine = create_demo_engine();

        let response = engine
            .execute_query_optimized("{ hello }", None, None)
            .unwrap();

        assert!(response.data.is_some());
        assert!(response.extensions.is_some()); // Optimized execution includes extensions
    }

    #[test]
    fn test_async_execution() {
        let engine = create_demo_engine();

        let rt = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .unwrap();
        let response = rt
            .block_on(engine.execute_query_async("{ version }", None, None))
            .unwrap();

        assert!(response.data.is_some());
        if let Some(data) = response.data {
            if let Some(version) = data.get("version") {
                assert_eq!(version, &json!("1.0.0"));
            }
        }
    }
}
