use super::*;
use crate::graphql::{GraphQLExecutor, GraphQLRequest, GraphQLSchema, ObjectType, Field as SchemaField, ScalarType, GraphQLType, GraphQLValue};

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn create_test_schema() -> GraphQLSchema {
        let query_type = ObjectType::new("Query")
            .add_field("hello", SchemaField::new(GraphQLType::Scalar(ScalarType::string())))
            .add_field("user", SchemaField::new(GraphQLType::Object(
                ObjectType::new("User")
                    .add_field("id", SchemaField::new(GraphQLType::Scalar(ScalarType::id())))
                    .add_field("name", SchemaField::new(GraphQLType::Scalar(ScalarType::string())))
                    .add_field("email", SchemaField::new(GraphQLType::Scalar(ScalarType::string())))
            )));

        GraphQLSchema::new(query_type)
    }

    fn create_test_executor() -> GraphQLExecutor {
        let schema = create_test_schema();
        let mut executor = GraphQLExecutor::new(schema);

        // Add resolver for "hello" field
        executor.add_resolver("Query", "hello", |_ctx| {
            Ok(GraphQLValue::String("Hello, World!".to_string()))
        });

        // Add resolver for "user" field
        executor.add_resolver("Query", "user", |_ctx| {
            Ok(GraphQLValue::Object([
                ("id".to_string(), GraphQLValue::String("1".to_string())),
                ("name".to_string(), GraphQLValue::String("John Doe".to_string())),
                ("email".to_string(), GraphQLValue::String("john@example.com".to_string())),
            ].iter().cloned().collect()))
        });

        // Add resolvers for User type fields
        executor.add_resolver("User", "id", |ctx| {
            if let Some(parent) = &ctx.parent {
                if let Some(id) = parent.get("id") {
                    Ok(GraphQLValue::String(id.as_str().unwrap_or("").to_string()))
                } else {
                    Ok(GraphQLValue::String("1".to_string()))
                }
            } else {
                Ok(GraphQLValue::String("1".to_string()))
            }
        });

        executor.add_resolver("User", "name", |ctx| {
            if let Some(parent) = &ctx.parent {
                if let Some(name) = parent.get("name") {
                    Ok(GraphQLValue::String(name.as_str().unwrap_or("").to_string()))
                } else {
                    Ok(GraphQLValue::String("John Doe".to_string()))
                }
            } else {
                Ok(GraphQLValue::String("John Doe".to_string()))
            }
        });

        executor.add_resolver("User", "email", |ctx| {
            if let Some(parent) = &ctx.parent {
                if let Some(email) = parent.get("email") {
                    Ok(GraphQLValue::String(email.as_str().unwrap_or("").to_string()))
                } else {
                    Ok(GraphQLValue::String("john@example.com".to_string()))
                }
            } else {
                Ok(GraphQLValue::String("john@example.com".to_string()))
            }
        });

        executor
    }

    #[test]
    fn test_simple_query() {
        let executor = create_test_executor();
        let request = GraphQLRequest {
            query: "{ hello }".to_string(),
            variables: None,
            operation_name: None,
        };

        let response = executor.execute(request);
        assert!(response.errors.is_none());
        assert!(response.data.is_some());

        let data = response.data.unwrap();
        assert_eq!(data["hello"], json!("Hello, World!"));
    }

    #[test]
    fn test_query_with_fields() {
        let executor = create_test_executor();
        let request = GraphQLRequest {
            query: "{ user { id name email } }".to_string(),
            variables: None,
            operation_name: None,
        };

        let response = executor.execute(request);
        assert!(response.errors.is_none());
        assert!(response.data.is_some());

        let data = response.data.unwrap();
        let user = &data["user"];
        assert_eq!(user["id"], json!("1"));
        assert_eq!(user["name"], json!("John Doe"));
        assert_eq!(user["email"], json!("john@example.com"));
    }

    #[test]
    fn test_invalid_query() {
        let executor = create_test_executor();
        let request = GraphQLRequest {
            query: "{ hello".to_string(), // Missing closing brace
            variables: None,
            operation_name: None,
        };

        let response = executor.execute(request);
        assert!(response.errors.is_some());
        assert!(response.data.is_none());
    }

    #[test]
    fn test_missing_resolver() {
        let executor = create_test_executor();
        let request = GraphQLRequest {
            query: "{ nonExistentField }".to_string(),
            variables: None,
            operation_name: None,
        };

        let response = executor.execute(request);
        assert!(response.errors.is_some());
        assert!(response.data.is_none());
    }

    #[test]
    fn test_parser_extract_fields() {
        let request = GraphQLRequest {
            query: "{ user { id name } hello }".to_string(),
            variables: None,
            operation_name: None,
        };

        let document = GraphQLParser::parse(&request).unwrap();
        let fields = GraphQLParser::extract_fields(&document).unwrap();
        
        assert!(fields.contains(&"user".to_string()));
        assert!(fields.contains(&"id".to_string()));
        assert!(fields.contains(&"name".to_string()));
        assert!(fields.contains(&"hello".to_string()));
    }

    #[test]
    fn test_parser_extract_operation_type() {
        let request = GraphQLRequest {
            query: "query GetUser { user { id } }".to_string(),
            variables: None,
            operation_name: None,
        };

        let document = GraphQLParser::parse(&request).unwrap();
        let operation_type = GraphQLParser::extract_operation_type(&document).unwrap();
        
        assert_eq!(operation_type, OperationType::Query);
    }

    #[test]
    fn test_lexer_integration() {
        // Test that our custom lexer can tokenize GraphQL queries
        let mut lexer = Lexer::new("query GetUser($id: ID!) { user(id: $id) { name email } }");
        let tokens = lexer.tokenize().unwrap();
        
        // Verify we get the expected tokens
        assert_eq!(tokens[0], Token::Query);
        assert_eq!(tokens[1], Token::Name("GetUser".to_string()));
        assert_eq!(tokens[2], Token::LeftParen);
        assert_eq!(tokens[3], Token::Dollar);
        assert_eq!(tokens[4], Token::Name("id".to_string()));
        assert_eq!(tokens[5], Token::Colon);
        assert_eq!(tokens[6], Token::Name("ID".to_string()));
        assert_eq!(tokens[7], Token::Exclamation);
        assert_eq!(tokens[8], Token::RightParen);
        assert_eq!(tokens[9], Token::LeftBrace);
        
        // Test that we can still parse the same query with the existing parser
        let request = GraphQLRequest {
            query: "query GetUser($id: ID!) { user(id: $id) { name email } }".to_string(),
            variables: Some(json!({"id": "123"})),
            operation_name: None,
        };
        
        let document = GraphQLParser::parse(&request).unwrap();
        let operation_type = GraphQLParser::extract_operation_type(&document).unwrap();
        assert_eq!(operation_type, OperationType::Query);
        
        let variables = GraphQLParser::extract_variables_used(&document);
        assert!(variables.contains(&"id".to_string()));
    }
}