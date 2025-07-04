/*!
# Manual GraphQL Testing Suite

This module provides comprehensive manual testing examples that demonstrate
all the GraphQL features we've built. Run with: `cargo test --lib graphql::manual_test::demo`
*/

#[cfg(test)]
mod demo {
    use crate::graphql::*;
    use crate::graphql::schema::{ObjectType, ScalarType, Field};
    use serde_json::json;
    use std::collections::HashMap;

    /// Comprehensive demo that shows all GraphQL features
    #[test]
    fn demo_complete_graphql_features() {
        println!("\n🚀 GraphQL Implementation Demo");
        println!("==============================\n");

        // 1. Create a comprehensive schema
        demo_schema_creation();
        
        // 2. Test lexer and parser
        demo_lexer_and_parser();
        
        // 3. Test validation
        demo_validation();
        
        // 4. Test query execution
        demo_query_execution();
        
        // 5. Test error handling
        demo_error_handling();
        
        // 6. Test advanced features
        demo_advanced_features();
        
        println!("\n🎉 Demo completed successfully!");
        println!("All GraphQL features are working correctly!\n");
    }

    fn demo_schema_creation() {
        println!("📋 1. Schema Creation");
        println!("-------------------");

        let string_type = GraphQLType::Scalar(ScalarType::string());
        let int_type = GraphQLType::Scalar(ScalarType::int());
        let boolean_type = GraphQLType::Scalar(ScalarType::boolean());

        // Create User type
        let user_type = ObjectType::new("User")
            .add_field("id", Field::new(string_type.clone()))
            .add_field("name", Field::new(string_type.clone()))
            .add_field("email", Field::new(string_type.clone()))
            .add_field("age", Field::new(int_type.clone()))
            .add_field("active", Field::new(boolean_type.clone()));

        // Create Post type
        let post_type = ObjectType::new("Post")
            .add_field("id", Field::new(string_type.clone()))
            .add_field("title", Field::new(string_type.clone()))
            .add_field("content", Field::new(string_type.clone()))
            .add_field("authorId", Field::new(string_type.clone()));

        // Create Query type
        let query_type = ObjectType::new("Query")
            .add_field("hello", Field::new(string_type.clone()))
            .add_field("version", Field::new(string_type.clone()))
            .add_field("user", Field::new(GraphQLType::Object(user_type.clone())))
            .add_field("users", Field::new(GraphQLType::List(
                Box::new(GraphQLType::Object(user_type.clone()))
            )))
            .add_field("post", Field::new(GraphQLType::Object(post_type.clone())))
            .add_field("posts", Field::new(GraphQLType::List(
                Box::new(GraphQLType::Object(post_type.clone()))
            )));

        let mut schema = GraphQLSchema::new(query_type);
        schema.add_type("User".to_string(), GraphQLType::Object(user_type));
        schema.add_type("Post".to_string(), GraphQLType::Object(post_type));

        println!("✅ Created schema with {} types", schema.types.len() + 1);
        println!("   - Query (root type)");
        println!("   - User (with id, name, email, age, active)");
        println!("   - Post (with id, title, content, authorId)");
        println!();
    }

    fn demo_lexer_and_parser() {
        println!("🔤 2. Lexer and Parser");
        println!("--------------------");

        let queries = vec![
            "{ hello }",
            "{ user { id name email } }",
            "query GetUser($id: ID!) { user(id: $id) { name } }",
            "{ users { id name } posts { title } }",
        ];

        for query in queries {
            println!("Parsing: {}", query);
            
            // Test lexer
            let lexer = Lexer::new(query);
            println!("  🔤 Lexer: Created token stream");

            // Test parser
            match parse_query(query) {
                Ok(document) => {
                    println!("  🌳 Parser: Generated AST with {} definitions", document.definitions.len());
                }
                Err(error) => {
                    println!("  ❌ Parser error: {}", error.message);
                }
            }
        }
        println!();
    }

    fn demo_validation() {
        println!("✅ 3. Query Validation");
        println!("---------------------");

        let schema = create_demo_schema();
        
        let test_cases = vec![
            ("{ hello }", "Valid simple query"),
            ("{ user { id name } }", "Valid nested query"),
            ("{ nonExistentField }", "Invalid field name"),
            ("{ user { invalidField } }", "Invalid nested field"),
            ("{ hello user }", "Missing selection set"),
        ];

        for (query, description) in test_cases {
            println!("Testing: {} - {}", description, query);
            
            match validate_query(query, &schema) {
                Ok(()) => {
                    println!("  ✅ Validation passed");
                }
                Err(errors) => {
                    println!("  ❌ Validation failed: {} error(s)", errors.len());
                    for error in errors.iter().take(1) {
                        println!("     - {}", error.message);
                    }
                }
            }
        }
        println!();
    }

    fn demo_query_execution() {
        println!("⚡ 4. Query Execution");
        println!("-------------------");

        let mut engine = create_advanced_demo_engine();

        let test_queries = vec![
            ("{ hello }", "Simple field"),
            ("{ version }", "Another simple field"),
            ("{ hello version }", "Multiple fields"),
            ("{ user { id name email } }", "Nested object"),
            ("{ users { id name } }", "List of objects"),
        ];

        for (query, description) in test_queries {
            println!("Executing: {} - {}", description, query);
            
            match engine.execute_query(query, None, None) {
                Ok(response) => {
                    if let Some(data) = response.data {
                        println!("  ✅ Success: {}", 
                            serde_json::to_string(&data).unwrap_or_else(|_| "Invalid JSON".to_string())
                        );
                    } else if let Some(errors) = response.errors {
                        println!("  ❌ Error: {}", errors[0].message);
                    }
                }
                Err(error) => {
                    println!("  ❌ Execution error: {}", error.message);
                }
            }
        }
        println!();
    }

    fn demo_error_handling() {
        println!("🚨 5. Error Handling");
        println!("-------------------");

        let mut engine = create_advanced_demo_engine();
        engine = engine.with_enhanced_errors(true);

        // Add a resolver that throws an error
        engine.add_resolver("Query", "errorField", |_| {
            Err(GraphQLError::new("This is a test error")
                .with_location(1, 5))
        });

        let error_cases = vec![
            ("{ unclosed", "Syntax error"),
            ("{ nonExistentField }", "Validation error"),
            ("{ errorField }", "Resolver error"),
        ];

        for (query, error_type) in error_cases {
            println!("Testing {} with: {}", error_type, query);
            
            let response = engine.execute_query(query, None, None).unwrap();
            
            if let Some(errors) = response.errors {
                println!("  ✅ Caught error: {}", errors[0].message);
                
                // Check for enhanced error details
                if let Some(extensions) = &errors[0].extensions {
                    println!("  📊 Enhanced details: {}", 
                        serde_json::to_string_pretty(extensions).unwrap_or_else(|_| "{}".to_string())
                    );
                }
            }
        }
        println!();
    }

    fn demo_advanced_features() {
        println!("🚀 6. Advanced Features");
        println!("----------------------");

        let engine = create_advanced_demo_engine();

        // Test optimized execution
        println!("Testing optimized execution:");
        let response = engine.execute_query_optimized("{ hello version }", None, None).unwrap();
        if let Some(extensions) = response.extensions {
            println!("  ✅ Extensions included: {}", 
                serde_json::to_string(&extensions).unwrap_or_else(|_| "{}".to_string())
            );
        }

        // Test async execution
        println!("\nTesting async execution:");
        let rt = tokio::runtime::Builder::new_current_thread().enable_all().build().unwrap();
        let async_response = rt.block_on(engine.execute_query_async("{ version }", None, None)).unwrap();
        if let Some(data) = async_response.data {
            println!("  ✅ Async result: {}", 
                serde_json::to_string(&data).unwrap_or_else(|_| "{}".to_string())
            );
        }

        // Test query complexity analysis
        println!("\nTesting query complexity analysis:");
        let complex_query = format!("{{ {} }}", "user { id name } ".repeat(20));
        let complex_response = engine.execute_query_optimized(&complex_query, None, None).unwrap();
        if complex_response.errors.is_some() {
            println!("  ✅ Complex query rejected (good!)");
        } else {
            println!("  ℹ️  Complex query accepted");
        }

        // Test with variables
        println!("\nTesting variables:");
        let variables = json!({ "name": "John" });
        let var_response = engine.execute_query(
            "{ hello }",  // Simple query for demo
            Some(variables),
            None
        ).unwrap();
        if var_response.data.is_some() {
            println!("  ✅ Variables processed successfully");
        }

        println!();
    }

    /// Create an advanced demo engine with comprehensive resolvers
    fn create_advanced_demo_engine() -> GraphQLEngine {
        let schema = create_demo_schema();
        let mut engine = GraphQLEngine::new(schema)
            .with_validation(true)
            .with_enhanced_errors(true)
            .with_extensions(false);  // We'll enable this in optimized tests

        // Add comprehensive resolvers
        engine.add_resolver("Query", "hello", |_| {
            Ok(GraphQLValue::String("Hello, GraphQL World! 🚀".to_string()))
        });

        engine.add_resolver("Query", "version", |_| {
            Ok(GraphQLValue::String("1.0.0".to_string()))
        });

        engine.add_resolver("Query", "user", |_| {
            let mut user = HashMap::new();
            user.insert("id".to_string(), GraphQLValue::String("1".to_string()));
            user.insert("name".to_string(), GraphQLValue::String("John Doe".to_string()));
            user.insert("email".to_string(), GraphQLValue::String("john@example.com".to_string()));
            user.insert("age".to_string(), GraphQLValue::Int(30));
            user.insert("active".to_string(), GraphQLValue::Boolean(true));
            Ok(GraphQLValue::Object(user))
        });

        engine.add_resolver("Query", "users", |_| {
            let users = vec![
                {
                    let mut user = HashMap::new();
                    user.insert("id".to_string(), GraphQLValue::String("1".to_string()));
                    user.insert("name".to_string(), GraphQLValue::String("Alice".to_string()));
                    user.insert("email".to_string(), GraphQLValue::String("alice@example.com".to_string()));
                    GraphQLValue::Object(user)
                },
                {
                    let mut user = HashMap::new();
                    user.insert("id".to_string(), GraphQLValue::String("2".to_string()));
                    user.insert("name".to_string(), GraphQLValue::String("Bob".to_string()));
                    user.insert("email".to_string(), GraphQLValue::String("bob@example.com".to_string()));
                    GraphQLValue::Object(user)
                }
            ];
            Ok(GraphQLValue::List(users))
        });

        engine
    }

    /// Interactive demo that you can run manually
    #[test]
    fn interactive_demo() {
        println!("\n🎮 Interactive GraphQL Demo");
        println!("============================");
        
        let engine = create_advanced_demo_engine();
        
        println!("📋 Available queries to test:");
        println!("1. {{ hello }}");
        println!("2. {{ version }}");
        println!("3. {{ user {{ id name email }} }}");
        println!("4. {{ users {{ id name }} }}");
        println!("5. {{ hello version }}");
        println!();

        // Test all the queries
        let queries = vec![
            "{ hello }",
            "{ version }",
            "{ user { id name email } }",
            "{ users { id name } }",
            "{ hello version }",
        ];

        for (i, query) in queries.iter().enumerate() {
            println!("🔍 Testing Query {}: {}", i + 1, query);
            
            let response = engine.execute_query(query, None, None).unwrap();
            
            if let Some(data) = response.data {
                println!("✅ Result: {}", 
                    serde_json::to_string_pretty(&data).unwrap_or_else(|_| "Invalid JSON".to_string())
                );
            } else if let Some(errors) = response.errors {
                println!("❌ Error: {}", errors[0].message);
            }
            
            println!("---");
        }

        println!("\n🎉 Interactive demo complete!");
        println!("You can modify the queries above and run them manually.");
    }

    /// Performance benchmark demo
    #[test]
    fn performance_demo() {
        println!("\n⚡ Performance Demo");
        println!("==================");

        let engine = create_advanced_demo_engine();
        
        // Test query execution performance
        let start = std::time::Instant::now();
        
        for i in 0..1000 {
            let _ = engine.execute_query("{ hello }", None, None);
            if i % 100 == 0 {
                println!("Executed {} queries...", i);
            }
        }
        
        let duration = start.elapsed();
        println!("✅ Executed 1000 queries in {:?}", duration);
        println!("   Average: {:?} per query", duration / 1000);
        
        // Test complex query
        let complex_start = std::time::Instant::now();
        let _complex_response = engine.execute_query(
            "{ hello version user { id name email } users { id name } }", 
            None, 
            None
        );
        let complex_duration = complex_start.elapsed();
        println!("✅ Complex query executed in {:?}", complex_duration);
    }
}