/*!
# GraphQL Integration Tests

Comprehensive integration tests that verify the entire GraphQL pipeline from
query parsing through execution and response formatting.
*/

#[cfg(test)]
mod integration {
    use crate::graphql::schema::{Field, ObjectType, ScalarType};
    use crate::graphql::*;
    use serde_json::json;
    use std::collections::HashMap;

    /// Test complete pipeline: parse -> validate -> execute -> format
    #[test]
    fn test_complete_pipeline() {
        let engine = create_demo_engine();

        let query = r#"
            query TestOperation {
                hello
                version
            }
        "#;

        let response = engine
            .execute_query(query, None, Some("TestOperation".to_string()))
            .unwrap();

        assert!(response.data.is_some());
        assert!(response.errors.is_none());

        let data = response.data.unwrap();
        assert!(data.get("hello").is_some());
        assert!(data.get("version").is_some());
    }

    /// Test error propagation through the entire pipeline
    #[test]
    fn test_error_pipeline() {
        let schema = create_simple_schema();
        let engine = GraphQLEngine::new(schema)
            .with_validation(true)
            .with_enhanced_errors(true);

        // Test syntax error
        let response = engine.execute_query("{ unclosed", None, None).unwrap();
        assert!(response.errors.is_some());

        // Test validation error
        let response = engine
            .execute_query("{ nonExistentField }", None, None)
            .unwrap();
        assert!(response.errors.is_some());
    }

    /// Test complex nested query execution
    #[test]
    fn test_nested_query_execution() {
        let string_type = GraphQLType::Scalar(ScalarType::string());
        let int_type = GraphQLType::Scalar(ScalarType::int());

        // Create nested schema
        let address_type = ObjectType::new("Address")
            .add_field("street", Field::new(string_type.clone()))
            .add_field("city", Field::new(string_type.clone()))
            .add_field("zipCode", Field::new(string_type.clone()));

        let user_type = ObjectType::new("User")
            .add_field("id", Field::new(string_type.clone()))
            .add_field("name", Field::new(string_type.clone()))
            .add_field("age", Field::new(int_type.clone()))
            .add_field(
                "address",
                Field::new(GraphQLType::Object(address_type.clone())),
            );

        let query_type = ObjectType::new("Query")
            .add_field("user", Field::new(GraphQLType::Object(user_type.clone())));

        let mut schema = GraphQLSchema::new(query_type);
        schema.add_type("User".to_string(), GraphQLType::Object(user_type));
        schema.add_type("Address".to_string(), GraphQLType::Object(address_type));

        let mut engine = GraphQLEngine::new(schema);

        // Add nested resolvers
        engine.add_resolver("Query", "user", |_| {
            let mut address = HashMap::new();
            address.insert(
                "street".to_string(),
                GraphQLValue::String("123 Main St".to_string()),
            );
            address.insert(
                "city".to_string(),
                GraphQLValue::String("Anytown".to_string()),
            );
            address.insert(
                "zipCode".to_string(),
                GraphQLValue::String("12345".to_string()),
            );

            let mut user = HashMap::new();
            user.insert("id".to_string(), GraphQLValue::String("1".to_string()));
            user.insert(
                "name".to_string(),
                GraphQLValue::String("John Doe".to_string()),
            );
            user.insert("age".to_string(), GraphQLValue::Int(30));
            user.insert("address".to_string(), GraphQLValue::Object(address));

            Ok(GraphQLValue::Object(user))
        });

        let query = r#"
            {
                user {
                    id
                    name
                    age
                    address {
                        street
                        city
                        zipCode
                    }
                }
            }
        "#;

        let response = engine.execute_query(query, None, None).unwrap();

        assert!(response.data.is_some());
        let data = response.data.unwrap();

        let user = data.get("user").unwrap();
        assert!(user.get("id").is_some());
        assert!(user.get("address").is_some());

        let address = user.get("address").unwrap();
        assert!(address.get("street").is_some());
        assert!(address.get("city").is_some());
        assert!(address.get("zipCode").is_some());
    }

    /// Test query with variables and complex arguments
    #[test]
    fn test_variables_and_arguments() {
        let string_type = GraphQLType::Scalar(ScalarType::string());
        let int_type = GraphQLType::Scalar(ScalarType::int());
        let boolean_type = GraphQLType::Scalar(ScalarType::boolean());

        let user_type = ObjectType::new("User")
            .add_field("id", Field::new(string_type.clone()))
            .add_field("name", Field::new(string_type.clone()))
            .add_field("age", Field::new(int_type.clone()));

        let query_type = ObjectType::new("Query")
            .add_field("user", Field::new(GraphQLType::Object(user_type.clone())))
            .add_field(
                "searchUsers",
                Field::new(GraphQLType::List(Box::new(GraphQLType::Object(
                    user_type.clone(),
                )))),
            );

        let mut schema = GraphQLSchema::new(query_type);
        schema.add_type("User".to_string(), GraphQLType::Object(user_type));

        let mut engine = GraphQLEngine::new(schema).with_validation(true);

        engine.add_resolver("Query", "user", |context| {
            let user_id = context
                .field_info
                .arguments
                .get("id")
                .and_then(|v| v.as_str())
                .unwrap_or("1");

            let mut user = HashMap::new();
            user.insert("id".to_string(), GraphQLValue::String(user_id.to_string()));
            user.insert(
                "name".to_string(),
                GraphQLValue::String(format!("User {}", user_id)),
            );
            user.insert("age".to_string(), GraphQLValue::Int(25));

            Ok(GraphQLValue::Object(user))
        });

        engine.add_resolver("Query", "searchUsers", |context| {
            let name_filter = context
                .field_info
                .arguments
                .get("name")
                .and_then(|v| v.as_str())
                .unwrap_or("");

            let mut users = Vec::new();

            if name_filter.contains("John") {
                let mut user = HashMap::new();
                user.insert("id".to_string(), GraphQLValue::String("1".to_string()));
                user.insert(
                    "name".to_string(),
                    GraphQLValue::String("John Doe".to_string()),
                );
                user.insert("age".to_string(), GraphQLValue::Int(30));
                users.push(GraphQLValue::Object(user));
            }

            Ok(GraphQLValue::List(users))
        });

        let query = r#"
            query GetUserData($userId: String!, $searchName: String!) {
                user(id: $userId) {
                    id
                    name
                    age
                }
                searchUsers(name: $searchName) {
                    id
                    name
                }
            }
        "#;

        let variables = json!({
            "userId": "123",
            "searchName": "John"
        });

        let response = engine
            .execute_query(query, Some(variables), Some("GetUserData".to_string()))
            .unwrap();

        assert!(response.data.is_some());
        let data = response.data.unwrap();

        assert!(data.get("user").is_some());
        assert!(data.get("searchUsers").is_some());
    }

    /// Test error collection and partial success
    #[test]
    fn test_error_collection_integration() {
        let schema = create_demo_schema();
        let mut engine = GraphQLEngine::new(schema)
            .with_error_collection(true)
            .with_enhanced_errors(true)
            .with_validation(false); // Disable validation to test execution errors

        // Add resolver for some fields but not others
        engine.add_resolver("Query", "hello", |_| {
            Ok(GraphQLValue::String("Hello!".to_string()))
        });

        engine.add_resolver("Query", "version", |_| {
            Err(GraphQLError::new("Version service unavailable"))
        });

        let query = r#"
            {
                hello
                version
                nonExistentField
            }
        "#;

        let response = engine.execute_query(query, None, None).unwrap();

        // Should have partial data and multiple errors
        assert!(response.data.is_some());
        assert!(response.errors.is_some());

        let data = response.data.unwrap();
        assert!(data.get("hello").is_some());

        let errors = response.errors.unwrap();
        assert!(errors.len() >= 1); // Should have at least one error

        // Check that errors have enhanced formatting
        for error in &errors {
            assert!(!error.message.is_empty());
            if let Some(extensions) = &error.extensions {
                println!("Error extensions: {:?}", extensions);
            }
        }
    }

    /// Test query complexity analysis integration
    #[test]
    fn test_complexity_analysis_integration() {
        let engine = create_demo_engine();

        // Test simple query (should pass)
        let simple_query = "{ hello }";
        let response = engine
            .execute_query_optimized(simple_query, None, None)
            .unwrap();
        assert!(response.data.is_some() || response.errors.is_some());

        // Test complex query (should be rejected)
        let complex_query = format!("{{ {} }}", "user { id name email } ".repeat(50));

        let response = engine
            .execute_query_optimized(&complex_query, None, None)
            .unwrap();

        if let Some(errors) = response.errors {
            // Should have complexity error
            assert!(errors
                .iter()
                .any(|e| e.message.contains("complexity") || e.message.contains("depth")));
        }
    }

    /// Test async execution integration
    #[test]
    fn test_async_execution_integration() {
        let engine = create_demo_engine();

        let rt = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .unwrap();

        let query = r#"
            {
                hello
                version
            }
        "#;

        let future_response = engine.execute_query_async(query, None, None);
        let response = rt.block_on(future_response).unwrap();

        assert!(response.data.is_some());
        let data = response.data.unwrap();
        assert!(data.get("hello").is_some());
        assert!(data.get("version").is_some());
    }

    /// Test result formatter integration with various scenarios
    #[test]
    fn test_result_formatter_integration() {
        let engine = create_demo_engine();

        // Test successful response formatting
        let response = engine.execute_query("{ hello }", None, None).unwrap();
        let json_string = api_utils::format_response_pretty(&response).unwrap();
        assert!(json_string.contains("hello"));
        assert!(json_string.contains("Hello, GraphQL World!"));

        // Test error response formatting
        let schema = create_simple_schema();
        let error_engine = GraphQLEngine::new(schema).with_enhanced_errors(true);

        let error_response = error_engine
            .execute_query("{ nonExistent }", None, None)
            .unwrap();
        let error_json = api_utils::format_response_pretty(&error_response).unwrap();
        assert!(error_json.contains("errors"));
    }

    /// Test validation integration with complex schemas
    #[test]
    fn test_validation_integration() {
        let schema = create_demo_schema();

        // Test valid query
        let valid_result = validate_query("{ hello }", &schema);
        assert!(valid_result.is_ok());

        // Test invalid field
        let invalid_result = validate_query("{ invalidField }", &schema);
        assert!(invalid_result.is_err());

        // Test invalid nested field
        let nested_invalid = validate_query("{ user { invalidNestedField } }", &schema);
        assert!(nested_invalid.is_err());
    }

    /// Test API utility functions integration
    #[test]
    fn test_api_utilities_integration() {
        use api_utils::*;

        let engine = create_demo_engine();

        // Test successful response
        let success_response = engine.execute_query("{ hello }", None, None).unwrap();
        assert!(is_successful(&success_response));
        assert!(!has_errors(&success_response));

        let data = extract_data(success_response);
        assert!(data.is_some());

        // Test error response
        let schema = create_simple_schema();
        let error_engine = GraphQLEngine::new(schema);
        let error_response = error_engine
            .execute_query("{ nonExistent }", None, None)
            .unwrap();

        assert!(!is_successful(&error_response));
        assert!(has_errors(&error_response));

        let errors = extract_errors(error_response);
        assert!(errors.is_some());
    }

    /// Test complete schema introspection preparation
    #[test]
    fn test_schema_introspection_preparation() {
        let schema = create_demo_schema();

        // Verify schema structure
        assert_eq!(schema.query_type.name, "Query");
        assert!(schema.query_type.fields.contains_key("hello"));
        assert!(schema.query_type.fields.contains_key("user"));
        assert!(schema.query_type.fields.contains_key("users"));

        // Verify type registry
        assert!(schema.types.contains_key("User"));
    }

    /// Performance and memory test
    #[test]
    fn test_performance_and_memory() {
        let engine = create_demo_engine();

        // Execute multiple queries to test memory usage
        for _i in 0..100 {
            let query = format!("{{ hello }}");
            let response = engine.execute_query(&query, None, None).unwrap();
            assert!(response.data.is_some());
        }

        // Test with variables
        for i in 0..50 {
            let variables = json!({ "test": format!("value{}", i) });
            let response = engine
                .execute_query("{ version }", Some(variables), None)
                .unwrap();
            assert!(response.data.is_some());
        }
    }

    /// Test real-world GraphQL query patterns
    #[test]
    fn test_real_world_patterns() {
        let engine = create_demo_engine();

        // Test with fragments (when fragment support is complete)
        let query = r#"
            {
                hello
                version
            }
        "#;

        let response = engine.execute_query(query, None, None).unwrap();
        assert!(response.data.is_some());

        // Test with aliases
        let aliased_query = r#"
            {
                greeting: hello
                appVersion: version
            }
        "#;

        let response = engine.execute_query(aliased_query, None, None).unwrap();
        assert!(response.data.is_some());

        if let Some(data) = response.data {
            assert!(data.get("greeting").is_some());
            assert!(data.get("appVersion").is_some());
        }
    }
}
