use crate::graphql::{GraphQLResponse, GraphQLError, GraphQLValue};
use serde_json::{Value, Map};
use std::collections::HashMap;

/// Result formatter for GraphQL responses
#[derive(Clone)]
pub struct ResultFormatter {
    /// Whether to include extensions in the response
    include_extensions: bool,
    /// Whether to format errors with enhanced details
    enhanced_errors: bool,
}

impl ResultFormatter {
    /// Create a new result formatter with default settings
    pub fn new() -> Self {
        Self {
            include_extensions: false,
            enhanced_errors: true,
        }
    }

    /// Enable or disable extensions in the response
    pub fn with_extensions(mut self, include_extensions: bool) -> Self {
        self.include_extensions = include_extensions;
        self
    }

    /// Enable or disable enhanced error formatting
    pub fn with_enhanced_errors(mut self, enhanced_errors: bool) -> Self {
        self.enhanced_errors = enhanced_errors;
        self
    }

    /// Format a successful execution result into a GraphQL response
    pub fn format_success(&self, data: GraphQLValue) -> GraphQLResponse {
        GraphQLResponse {
            data: Some(self.format_data(data)),
            errors: None,
            extensions: if self.include_extensions {
                Some(self.create_success_extensions())
            } else {
                None
            },
        }
    }

    /// Format an error result into a GraphQL response
    pub fn format_error(&self, error: GraphQLError) -> GraphQLResponse {
        GraphQLResponse {
            data: None,
            errors: Some(vec![self.format_single_error(error)]),
            extensions: if self.include_extensions {
                Some(self.create_error_extensions())
            } else {
                None
            },
        }
    }

    /// Format multiple errors into a GraphQL response
    pub fn format_errors(&self, errors: Vec<GraphQLError>) -> GraphQLResponse {
        GraphQLResponse {
            data: None,
            errors: Some(errors.into_iter().map(|e| self.format_single_error(e)).collect()),
            extensions: if self.include_extensions {
                Some(self.create_error_extensions())
            } else {
                None
            },
        }
    }

    /// Format a partial success result (data with errors)
    pub fn format_partial_success(&self, data: GraphQLValue, errors: Vec<GraphQLError>) -> GraphQLResponse {
        GraphQLResponse {
            data: Some(self.format_data(data)),
            errors: Some(errors.into_iter().map(|e| self.format_single_error(e)).collect()),
            extensions: if self.include_extensions {
                Some(self.create_partial_success_extensions())
            } else {
                None
            },
        }
    }

    /// Format GraphQL data into JSON value
    fn format_data(&self, data: GraphQLValue) -> Value {
        data.into()
    }

    /// Format a single error with enhanced details if enabled
    fn format_single_error(&self, mut error: GraphQLError) -> GraphQLError {
        if self.enhanced_errors {
            // Add additional error metadata if not already present
            if error.extensions.is_none() {
                let mut extensions = Map::new();
                extensions.insert("timestamp".to_string(), Value::String(
                    chrono::Utc::now().to_rfc3339()
                ));
                error.extensions = Some(Value::Object(extensions));
            } else if let Some(Value::Object(ref mut ext)) = error.extensions {
                // Add timestamp if not present
                if !ext.contains_key("timestamp") {
                    ext.insert("timestamp".to_string(), Value::String(
                        chrono::Utc::now().to_rfc3339()
                    ));
                }
            }
        }
        error
    }

    /// Create extensions for successful responses
    fn create_success_extensions(&self) -> Value {
        let mut extensions = Map::new();
        extensions.insert("execution_time".to_string(), Value::String("completed".to_string()));
        extensions.insert("result_type".to_string(), Value::String("success".to_string()));
        Value::Object(extensions)
    }

    /// Create extensions for error responses
    fn create_error_extensions(&self) -> Value {
        let mut extensions = Map::new();
        extensions.insert("execution_time".to_string(), Value::String("failed".to_string()));
        extensions.insert("result_type".to_string(), Value::String("error".to_string()));
        Value::Object(extensions)
    }

    /// Create extensions for partial success responses
    fn create_partial_success_extensions(&self) -> Value {
        let mut extensions = Map::new();
        extensions.insert("execution_time".to_string(), Value::String("partial".to_string()));
        extensions.insert("result_type".to_string(), Value::String("partial_success".to_string()));
        Value::Object(extensions)
    }
}

impl Default for ResultFormatter {
    fn default() -> Self {
        Self::new()
    }
}

/// Utility functions for result formatting
pub mod utils {
    use super::*;

    /// Format a GraphQL value as a pretty-printed JSON string
    pub fn format_as_json_string(value: &GraphQLValue) -> Result<String, serde_json::Error> {
        let json_value: Value = value.clone().into();
        serde_json::to_string_pretty(&json_value)
    }

    /// Format a GraphQL response as a pretty-printed JSON string
    pub fn format_response_as_json_string(response: &GraphQLResponse) -> Result<String, serde_json::Error> {
        serde_json::to_string_pretty(response)
    }

    /// Validate that a GraphQL response conforms to the GraphQL specification
    pub fn validate_response_format(response: &GraphQLResponse) -> Result<(), String> {
        // Check that at least one of data or errors is present
        if response.data.is_none() && response.errors.is_none() {
            return Err("Response must contain either data or errors".to_string());
        }

        // If errors are present, validate error format
        if let Some(ref errors) = response.errors {
            if errors.is_empty() {
                return Err("Errors array cannot be empty when present".to_string());
            }

            for error in errors {
                if error.message.is_empty() {
                    return Err("Error message cannot be empty".to_string());
                }
            }
        }

        Ok(())
    }

    /// Create a null data response (useful for mutations that don't return data)
    pub fn create_null_data_response() -> GraphQLResponse {
        GraphQLResponse {
            data: Some(Value::Null),
            errors: None,
            extensions: None,
        }
    }

    /// Merge multiple GraphQL responses (useful for batch operations)
    pub fn merge_responses(responses: Vec<GraphQLResponse>) -> GraphQLResponse {
        let mut merged_data = HashMap::new();
        let mut merged_errors = Vec::new();
        let mut merged_extensions = Map::new();

        for (index, response) in responses.into_iter().enumerate() {
            // Merge data
            if let Some(data) = response.data {
                merged_data.insert(format!("operation_{}", index), data);
            }

            // Merge errors
            if let Some(errors) = response.errors {
                merged_errors.extend(errors);
            }

            // Merge extensions
            if let Some(Value::Object(extensions)) = response.extensions {
                for (key, value) in extensions {
                    merged_extensions.insert(format!("operation_{}_{}", index, key), value);
                }
            }
        }

        GraphQLResponse {
            data: if merged_data.is_empty() {
                None
            } else {
                Some(Value::Object(merged_data.into_iter().collect()))
            },
            errors: if merged_errors.is_empty() {
                None
            } else {
                Some(merged_errors)
            },
            extensions: if merged_extensions.is_empty() {
                None
            } else {
                Some(Value::Object(merged_extensions))
            },
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn test_format_success() {
        let formatter = ResultFormatter::new();
        let data = GraphQLValue::Object([
            ("hello".to_string(), GraphQLValue::String("world".to_string())),
        ].into_iter().collect());

        let response = formatter.format_success(data);

        assert!(response.data.is_some());
        assert!(response.errors.is_none());
        assert!(response.extensions.is_none()); // Default is no extensions
    }

    #[test]
    fn test_format_success_with_extensions() {
        let formatter = ResultFormatter::new().with_extensions(true);
        let data = GraphQLValue::Object([
            ("hello".to_string(), GraphQLValue::String("world".to_string())),
        ].into_iter().collect());

        let response = formatter.format_success(data);

        assert!(response.data.is_some());
        assert!(response.errors.is_none());
        assert!(response.extensions.is_some());
    }

    #[test]
    fn test_format_error() {
        let formatter = ResultFormatter::new();
        let error = GraphQLError::new("Test error");

        let response = formatter.format_error(error);

        assert!(response.data.is_none());
        assert!(response.errors.is_some());
        
        let errors = response.errors.unwrap();
        assert_eq!(errors.len(), 1);
        assert_eq!(errors[0].message, "Test error");
    }

    #[test]
    fn test_format_multiple_errors() {
        let formatter = ResultFormatter::new();
        let errors = vec![
            GraphQLError::new("Error 1"),
            GraphQLError::new("Error 2"),
        ];

        let response = formatter.format_errors(errors);

        assert!(response.data.is_none());
        assert!(response.errors.is_some());
        
        let response_errors = response.errors.unwrap();
        assert_eq!(response_errors.len(), 2);
    }

    #[test]
    fn test_format_partial_success() {
        let formatter = ResultFormatter::new();
        let data = GraphQLValue::Object([
            ("hello".to_string(), GraphQLValue::String("world".to_string())),
        ].into_iter().collect());
        let errors = vec![GraphQLError::new("Warning message")];

        let response = formatter.format_partial_success(data, errors);

        assert!(response.data.is_some());
        assert!(response.errors.is_some());
        
        let response_errors = response.errors.unwrap();
        assert_eq!(response_errors.len(), 1);
    }

    #[test]
    fn test_enhanced_errors() {
        let formatter = ResultFormatter::new().with_enhanced_errors(true);
        let error = GraphQLError::new("Test error");

        let response = formatter.format_error(error);

        assert!(response.errors.is_some());
        let errors = response.errors.unwrap();
        assert_eq!(errors.len(), 1);
        
        // Check that timestamp was added
        assert!(errors[0].extensions.is_some());
        if let Some(Value::Object(ref ext)) = errors[0].extensions {
            assert!(ext.contains_key("timestamp"));
        }
    }

    #[test]
    fn test_validate_response_format() {
        use utils::validate_response_format;

        // Valid response with data
        let valid_response = GraphQLResponse {
            data: Some(json!({"hello": "world"})),
            errors: None,
            extensions: None,
        };
        assert!(validate_response_format(&valid_response).is_ok());

        // Valid response with errors
        let valid_error_response = GraphQLResponse {
            data: None,
            errors: Some(vec![GraphQLError::new("Test error")]),
            extensions: None,
        };
        assert!(validate_response_format(&valid_error_response).is_ok());

        // Invalid response with neither data nor errors
        let invalid_response = GraphQLResponse {
            data: None,
            errors: None,
            extensions: None,
        };
        assert!(validate_response_format(&invalid_response).is_err());
    }

    #[test]
    fn test_format_as_json_string() {
        use utils::format_as_json_string;

        let value = GraphQLValue::Object([
            ("hello".to_string(), GraphQLValue::String("world".to_string())),
        ].into_iter().collect());

        let json_string = format_as_json_string(&value).unwrap();
        assert!(json_string.contains("hello"));
        assert!(json_string.contains("world"));
    }

    #[test]
    fn test_merge_responses() {
        use utils::merge_responses;

        let response1 = GraphQLResponse {
            data: Some(json!({"field1": "value1"})),
            errors: None,
            extensions: None,
        };

        let response2 = GraphQLResponse {
            data: Some(json!({"field2": "value2"})),
            errors: Some(vec![GraphQLError::new("Error 1")]),
            extensions: None,
        };

        let merged = merge_responses(vec![response1, response2]);

        assert!(merged.data.is_some());
        assert!(merged.errors.is_some());
        
        let errors = merged.errors.unwrap();
        assert_eq!(errors.len(), 1);
    }
}