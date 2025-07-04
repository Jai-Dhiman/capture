/*!
# GraphQL Usage Examples

This module contains practical examples of how to use the GraphQL parser and executor
in various scenarios.
*/

#[cfg(test)]
mod examples {
    use crate::graphql::*;
    use crate::graphql::schema::{ObjectType, ScalarType, Field};
    use serde_json::json;
    use std::collections::HashMap;

    /// Example 1: Basic Query Execution
    #[test]
    fn example_basic_query() {
        // Create a simple schema
        let schema = create_simple_schema();
        
        // Create an engine with basic configuration
        let mut engine = GraphQLEngine::new(schema)
            .with_validation(true);

        // Add a simple resolver
        engine.add_resolver("Query", "hello", |_| {
            Ok(GraphQLValue::String("Hello, World!".to_string()))
        });

        // Execute a basic query
        let response = engine.execute_query("{ hello }", None, None).unwrap();
        
        println!("Basic Query Response: {:?}", response.data);
        assert!(response.data.is_some());
    }

    /// Example 2: Query with Variables
    #[test]
    fn example_query_with_variables() {
        let schema = create_demo_schema();
        let mut engine = GraphQLEngine::new(schema)
            .with_validation(true)
            .with_enhanced_errors(true);

        // Add a resolver that uses arguments
        engine.add_resolver("Query", "user", |context| {
            let user_id = context.field_info.arguments
                .get("id")
                .and_then(|v| v.as_str())
                .unwrap_or("1");

            let mut user = HashMap::new();
            user.insert("id".to_string(), GraphQLValue::String(user_id.to_string()));
            user.insert("name".to_string(), GraphQLValue::String(format!("User {}", user_id)));
            user.insert("email".to_string(), GraphQLValue::String(format!("user{}@example.com", user_id)));
            
            Ok(GraphQLValue::Object(user))
        });

        let query = r#"
            query GetUser($userId: String!) {
                user(id: $userId) {
                    id
                    name
                    email
                }
            }
        "#;

        let variables = json!({
            "userId": "123"
        });

        let response = engine.execute_query(query, Some(variables), Some("GetUser".to_string())).unwrap();
        
        println!("Query with Variables Response: {:?}", response.data);
        assert!(response.data.is_some());
    }

    /// Example 3: Error Handling
    #[test]
    fn example_error_handling() {
        let schema = create_simple_schema();
        let engine = GraphQLEngine::new(schema)
            .with_validation(true)
            .with_enhanced_errors(true);

        // Execute an invalid query
        let response = engine.execute_query("{ nonExistentField }", None, None).unwrap();
        
        println!("Error Response: {:?}", response.errors);
        assert!(response.errors.is_some());
        
        if let Some(errors) = response.errors {
            assert!(!errors.is_empty());
            println!("First error message: {}", errors[0].message);
        }
    }

    /// Example 4: Complex Schema with Nested Objects
    #[test]
    fn example_complex_schema() {
        // Create a more complex schema
        let string_type = GraphQLType::Scalar(ScalarType::string());
        let int_type = GraphQLType::Scalar(ScalarType::int());

        // Profile type
        let profile_type = ObjectType::new("Profile")
            .add_field("avatar", Field::new(string_type.clone()))
            .add_field("bio", Field::new(string_type.clone()));

        // User type with profile
        let user_type = ObjectType::new("User")
            .add_field("id", Field::new(string_type.clone()))
            .add_field("name", Field::new(string_type.clone()))
            .add_field("profile", Field::new(GraphQLType::Object(profile_type.clone())));

        // Query type
        let query_type = ObjectType::new("Query")
            .add_field("user", Field::new(GraphQLType::Object(user_type.clone())));

        let mut schema = GraphQLSchema::new(query_type);
        schema.add_type("User".to_string(), GraphQLType::Object(user_type));
        schema.add_type("Profile".to_string(), GraphQLType::Object(profile_type));

        let mut engine = GraphQLEngine::new(schema);

        // Add resolvers
        engine.add_resolver("Query", "user", |_| {
            let mut profile = HashMap::new();
            profile.insert("avatar".to_string(), GraphQLValue::String("avatar.jpg".to_string()));
            profile.insert("bio".to_string(), GraphQLValue::String("Software developer".to_string()));

            let mut user = HashMap::new();
            user.insert("id".to_string(), GraphQLValue::String("1".to_string()));
            user.insert("name".to_string(), GraphQLValue::String("John Doe".to_string()));
            user.insert("profile".to_string(), GraphQLValue::Object(profile));

            Ok(GraphQLValue::Object(user))
        });

        let query = r#"
            {
                user {
                    id
                    name
                    profile {
                        avatar
                        bio
                    }
                }
            }
        "#;

        let response = engine.execute_query(query, None, None).unwrap();
        
        println!("Complex Schema Response: {:?}", response.data);
        assert!(response.data.is_some());
    }

    /// Example 5: List Handling
    #[test]
    fn example_list_handling() {
        let schema = create_demo_schema();
        let mut engine = GraphQLEngine::new(schema);

        engine.add_resolver("Query", "users", |_| {
            let user1 = {
                let mut user = HashMap::new();
                user.insert("id".to_string(), GraphQLValue::String("1".to_string()));
                user.insert("name".to_string(), GraphQLValue::String("Alice".to_string()));
                user.insert("email".to_string(), GraphQLValue::String("alice@example.com".to_string()));
                GraphQLValue::Object(user)
            };

            let user2 = {
                let mut user = HashMap::new();
                user.insert("id".to_string(), GraphQLValue::String("2".to_string()));
                user.insert("name".to_string(), GraphQLValue::String("Bob".to_string()));
                user.insert("email".to_string(), GraphQLValue::String("bob@example.com".to_string()));
                GraphQLValue::Object(user)
            };

            Ok(GraphQLValue::List(vec![user1, user2]))
        });

        let query = r#"
            {
                users {
                    id
                    name
                    email
                }
            }
        "#;

        let response = engine.execute_query(query, None, None).unwrap();
        
        println!("List Handling Response: {:?}", response.data);
        assert!(response.data.is_some());
    }

    /// Example 6: Optimized Execution with Complexity Analysis
    #[test]
    fn example_optimized_execution() {
        let engine = create_demo_engine();

        let query = "{ hello version }";

        // Execute with optimizations
        let response = engine.execute_query_optimized(query, None, None).unwrap();
        
        println!("Optimized Response: {:?}", response);
        assert!(response.data.is_some());
        assert!(response.extensions.is_some()); // Optimized execution includes extensions
    }

    /// Example 7: Async Execution
    #[test]
    fn example_async_execution() {
        let engine = create_demo_engine();

        let rt = tokio::runtime::Builder::new_current_thread().enable_all().build().unwrap();
        
        let future_response = engine.execute_query_async("{ hello }", None, None);
        let response = rt.block_on(future_response).unwrap();
        
        println!("Async Response: {:?}", response.data);
        assert!(response.data.is_some());
    }

    /// Example 8: Custom Error Handling
    #[test]
    fn example_custom_error_handling() {
        let schema = create_simple_schema();
        let mut engine = GraphQLEngine::new(schema)
            .with_enhanced_errors(true);

        engine.add_resolver("Query", "hello", |_| {
            Err(GraphQLError::new("Custom resolver error")
                .with_location(1, 3))
        });

        let response = engine.execute_query("{ hello }", None, None).unwrap();
        
        println!("Custom Error Response: {:?}", response.errors);
        assert!(response.errors.is_some());
        
        if let Some(errors) = response.errors {
            assert_eq!(errors[0].message, "Custom resolver error");
            assert!(errors[0].locations.is_some());
        }
    }

    /// Example 9: Partial Success Handling
    #[test]
    fn example_partial_success() {
        let schema = create_simple_schema();
        let mut engine = GraphQLEngine::new(schema)
            .with_error_collection(true) // Enable error collection for partial success
            .with_validation(false); // Disable validation to test execution errors

        // Add resolver for hello but not for other fields
        engine.add_resolver("Query", "hello", |_| {
            Ok(GraphQLValue::String("Hello, World!".to_string()))
        });

        let response = engine.execute_query("{ hello nonExistentField }", None, None).unwrap();
        
        println!("Partial Success Response: {:?}", response);
        // Should have both data and errors
        assert!(response.data.is_some());
        assert!(response.errors.is_some());
    }

    /// Example 10: Response Formatting and Utilities
    #[test]
    fn example_response_utilities() {
        use api_utils::*;

        let engine = create_demo_engine();
        let response = engine.execute_query("{ hello }", None, None).unwrap();

        // Check response status
        println!("Is successful: {}", is_successful(&response));
        println!("Has errors: {}", has_errors(&response));

        // Format response as pretty JSON
        let json_string = format_response_pretty(&response).unwrap();
        println!("Pretty JSON:\n{}", json_string);

        // Extract data
        if let Some(data) = extract_data(response) {
            println!("Extracted data: {:?}", data);
        }
    }

    /// Example 11: Query Parsing and Validation
    #[test]
    fn example_query_parsing_and_validation() {
        // Parse a query
        let query = "{ user { id name } }";
        let document = parse_query(query).unwrap();
        
        println!("Parsed document operations: {}", document.definitions.len());

        // Validate against schema
        let schema = create_demo_schema();
        let validation_result = validate_query(query, &schema);
        
        match validation_result {
            Ok(()) => println!("Query is valid"),
            Err(errors) => println!("Validation errors: {:?}", errors),
        }
    }

    /// Example 12: Working with Raw Components
    #[test]
    fn example_raw_components() {
        use crate::graphql::{Lexer, CustomParser, Validator, QueryExecutor};

        let query = "{ hello }";

        // 1. Lexical analysis
        let lexer = Lexer::new(query);
        println!("Tokenization starting...");

        // 2. Parsing
        let mut parser = CustomParser::new(lexer).unwrap();
        let document = parser.parse().unwrap();
        println!("Parsed {} definitions", document.definitions.len());

        // 3. Create execution context and validate
        let schema = create_simple_schema();
        // Note: Full validation requires execution context setup
        
        // 4. Execute
        let executor = QueryExecutor::new(schema);
        let request = GraphQLRequest {
            query: query.to_string(),
            variables: None,
            operation_name: None,
        };
        
        let response = executor.execute(request);
        println!("Raw execution response: {:?}", response);
    }
}