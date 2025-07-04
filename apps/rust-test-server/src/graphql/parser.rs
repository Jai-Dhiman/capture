use crate::graphql::{
    GraphQLError, GraphQLRequest, Document, Definition,
    Selection, Value, SelectionSet, CustomParser, Lexer
};

pub struct GraphQLParser;

#[derive(Debug, Clone, PartialEq)]
pub enum OperationType {
    Query,
    Mutation,
    Subscription,
}

impl GraphQLParser {
    pub fn parse(request: &GraphQLRequest) -> Result<Document, GraphQLError> {
        let lexer = Lexer::new(&request.query);
        let mut parser = CustomParser::new(lexer)?;
        parser.parse()
    }

    pub fn validate_query(query: &str) -> Result<Document, GraphQLError> {
        let lexer = Lexer::new(query);
        let mut parser = CustomParser::new(lexer)?;
        parser.parse()
    }

    pub fn extract_operation_name(document: &Document) -> Option<String> {
        for definition in &document.definitions {
            if let Definition::Operation(operation_definition) = definition {
                return operation_definition.name.clone();
            }
        }
        None
    }

    pub fn extract_operation_type(document: &Document) -> Result<OperationType, GraphQLError> {
        for definition in &document.definitions {
            if let Definition::Operation(operation_definition) = definition {
                return Ok(match operation_definition.operation_type {
                    crate::graphql::AstOperationType::Query => OperationType::Query,
                    crate::graphql::AstOperationType::Mutation => OperationType::Mutation,
                    crate::graphql::AstOperationType::Subscription => OperationType::Subscription,
                });
            }
        }
        Err(GraphQLError::new("No operation found in document"))
    }

    pub fn extract_fields(document: &Document) -> Result<Vec<String>, GraphQLError> {
        let mut fields = Vec::new();
        
        for definition in &document.definitions {
            if let Definition::Operation(operation_definition) = definition {
                Self::extract_fields_from_selection_set(&operation_definition.selection_set, &mut fields);
                break;
            }
        }
        
        Ok(fields)
    }

    fn extract_fields_from_selection_set(selection_set: &SelectionSet, fields: &mut Vec<String>) {
        for selection in &selection_set.selections {
            match selection {
                Selection::Field(field) => {
                    fields.push(field.name.clone());
                    if let Some(sub_selection_set) = &field.selection_set {
                        Self::extract_fields_from_selection_set(sub_selection_set, fields);
                    }
                }
                Selection::InlineFragment(inline_fragment) => {
                    Self::extract_fields_from_selection_set(&inline_fragment.selection_set, fields);
                }
                Selection::FragmentSpread(_) => {
                    // Fragment spreads would need to be resolved with fragment definitions
                    // For now, we'll skip them in this basic implementation
                }
            }
        }
    }

    pub fn extract_variables_used(document: &Document) -> Vec<String> {
        let mut variables = Vec::new();
        
        for definition in &document.definitions {
            if let Definition::Operation(operation_definition) = definition {
                Self::extract_variables_from_selection_set(&operation_definition.selection_set, &mut variables);
                break;
            }
        }
        
        variables
    }

    fn extract_variables_from_selection_set(selection_set: &SelectionSet, variables: &mut Vec<String>) {
        for selection in &selection_set.selections {
            match selection {
                Selection::Field(field) => {
                    for argument in &field.arguments {
                        Self::extract_variables_from_value(&argument.value, variables);
                    }
                    if let Some(sub_selection_set) = &field.selection_set {
                        Self::extract_variables_from_selection_set(sub_selection_set, variables);
                    }
                }
                Selection::InlineFragment(inline_fragment) => {
                    Self::extract_variables_from_selection_set(&inline_fragment.selection_set, variables);
                }
                Selection::FragmentSpread(_) => {
                    // Fragment spreads would need to be resolved with fragment definitions
                }
            }
        }
    }

    fn extract_variables_from_value(value: &Value, variables: &mut Vec<String>) {
        match value {
            Value::Variable(var) => {
                if !variables.contains(&var.name) {
                    variables.push(var.name.clone());
                }
            }
            Value::ListValue(list) => {
                for item in list {
                    Self::extract_variables_from_value(item, variables);
                }
            }
            Value::ObjectValue(obj) => {
                for (_, val) in obj {
                    Self::extract_variables_from_value(val, variables);
                }
            }
            _ => {}
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn test_parse_simple_query() {
        let request = GraphQLRequest {
            query: "{ hello }".to_string(),
            variables: None,
            operation_name: None,
        };

        let result = GraphQLParser::parse(&request);
        assert!(result.is_ok());
    }

    #[test]
    fn test_parse_invalid_query() {
        let request = GraphQLRequest {
            query: "{ hello".to_string(), // Missing closing brace
            variables: None,
            operation_name: None,
        };

        let result = GraphQLParser::parse(&request);
        assert!(result.is_err());
    }

    #[test]
    fn test_extract_fields() {
        let request = GraphQLRequest {
            query: "{ user { name email } }".to_string(),
            variables: None,
            operation_name: None,
        };

        let document = GraphQLParser::parse(&request).unwrap();
        let fields = GraphQLParser::extract_fields(&document).unwrap();
        
        assert!(fields.contains(&"user".to_string()));
        assert!(fields.contains(&"name".to_string()));
        assert!(fields.contains(&"email".to_string()));
    }

    #[test]
    fn test_extract_variables() {
        let request = GraphQLRequest {
            query: "query GetUser($id: ID!) { user(id: $id) { name } }".to_string(),
            variables: Some(json!({"id": "123"})),
            operation_name: None,
        };

        let document = GraphQLParser::parse(&request).unwrap();
        let variables = GraphQLParser::extract_variables_used(&document);
        
        assert!(variables.contains(&"id".to_string()));
    }
}