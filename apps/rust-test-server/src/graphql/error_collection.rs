use crate::graphql::GraphQLError;
use serde_json::Value;
use std::collections::VecDeque;
use std::fmt;

/// Error categories for better classification and handling
#[derive(Debug, Clone, PartialEq)]
pub enum ErrorCategory {
    /// Syntax errors during parsing
    Syntax,
    /// Validation errors against schema
    Validation,
    /// Runtime execution errors
    Execution,
    /// Field resolution errors
    FieldResolution,
    /// Type coercion errors
    TypeCoercion,
    /// Authorization/permission errors
    Authorization,
    /// Internal server errors
    Internal,
}

/// Enhanced GraphQL error with additional metadata
#[derive(Debug, Clone)]
pub struct EnhancedGraphQLError {
    pub error: GraphQLError,
    pub category: ErrorCategory,
    pub severity: ErrorSeverity,
    pub source: Option<String>,
    pub timestamp: Option<std::time::SystemTime>,
}

/// Error severity levels
#[derive(Debug, Clone, PartialEq)]
pub enum ErrorSeverity {
    Low,
    Medium,
    High,
    Critical,
}

impl EnhancedGraphQLError {
    pub fn new(message: impl Into<String>, category: ErrorCategory) -> Self {
        Self {
            error: GraphQLError::new(message),
            category,
            severity: ErrorSeverity::Medium,
            source: None,
            timestamp: Some(std::time::SystemTime::now()),
        }
    }

    pub fn with_severity(mut self, severity: ErrorSeverity) -> Self {
        self.severity = severity;
        self
    }

    pub fn with_location(mut self, line: u32, column: u32) -> Self {
        self.error = self.error.with_location(line, column);
        self
    }

    pub fn with_path(mut self, path: Vec<Value>) -> Self {
        self.error = self.error.with_path(path);
        self
    }

    pub fn with_source(mut self, source: impl Into<String>) -> Self {
        self.source = Some(source.into());
        self
    }

    /// Convert to basic GraphQLError for response serialization
    pub fn to_graphql_error(self) -> GraphQLError {
        let mut error = self.error;
        
        // Add category and severity to extensions
        let mut extensions = serde_json::Map::new();
        extensions.insert("category".to_string(), Value::String(format!("{:?}", self.category)));
        extensions.insert("severity".to_string(), Value::String(format!("{:?}", self.severity)));
        
        if let Some(source) = self.source {
            extensions.insert("source".to_string(), Value::String(source));
        }
        
        if let Some(timestamp) = self.timestamp {
            if let Ok(duration) = timestamp.duration_since(std::time::UNIX_EPOCH) {
                extensions.insert("timestamp".to_string(), Value::Number(duration.as_secs().into()));
            }
        }
        
        error.extensions = Some(Value::Object(extensions));
        error
    }
}

impl fmt::Display for EnhancedGraphQLError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "[{:?}] {}", self.category, self.error.message)
    }
}

impl std::error::Error for EnhancedGraphQLError {}

/// Collection for managing multiple GraphQL errors during execution
pub struct GraphQLErrorCollection {
    errors: VecDeque<EnhancedGraphQLError>,
    max_errors: usize,
    fail_fast: bool,
}

impl GraphQLErrorCollection {
    /// Create a new error collection
    pub fn new() -> Self {
        Self {
            errors: VecDeque::new(),
            max_errors: 100, // Prevent memory exhaustion
            fail_fast: false,
        }
    }

    /// Create a new error collection with fail-fast behavior
    pub fn new_fail_fast() -> Self {
        Self {
            errors: VecDeque::new(),
            max_errors: 1,
            fail_fast: true,
        }
    }

    /// Set maximum number of errors to collect
    pub fn with_max_errors(mut self, max_errors: usize) -> Self {
        self.max_errors = max_errors;
        self
    }

    /// Add an error to the collection
    pub fn add_error(&mut self, error: EnhancedGraphQLError) -> Result<(), GraphQLError> {
        if self.errors.len() >= self.max_errors {
            if self.fail_fast {
                return Err(error.to_graphql_error());
            } else {
                // Remove oldest error to make room
                self.errors.pop_front();
            }
        }

        self.errors.push_back(error);

        if self.fail_fast {
            Err(self.errors.back().unwrap().clone().to_graphql_error())
        } else {
            Ok(())
        }
    }

    /// Add a simple error message
    pub fn add_simple_error(&mut self, message: impl Into<String>, category: ErrorCategory) -> Result<(), GraphQLError> {
        let error = EnhancedGraphQLError::new(message, category);
        self.add_error(error)
    }

    /// Add a syntax error with location
    pub fn add_syntax_error(&mut self, message: impl Into<String>, line: u32, column: u32) -> Result<(), GraphQLError> {
        let error = EnhancedGraphQLError::new(message, ErrorCategory::Syntax)
            .with_severity(ErrorSeverity::High)
            .with_location(line, column);
        self.add_error(error)
    }

    /// Add a validation error
    pub fn add_validation_error(&mut self, message: impl Into<String>) -> Result<(), GraphQLError> {
        let error = EnhancedGraphQLError::new(message, ErrorCategory::Validation)
            .with_severity(ErrorSeverity::High);
        self.add_error(error)
    }

    /// Add an execution error with path
    pub fn add_execution_error(&mut self, message: impl Into<String>, path: Vec<Value>) -> Result<(), GraphQLError> {
        let error = EnhancedGraphQLError::new(message, ErrorCategory::Execution)
            .with_severity(ErrorSeverity::Medium)
            .with_path(path);
        self.add_error(error)
    }

    /// Add a field resolution error
    pub fn add_field_error(&mut self, message: impl Into<String>, field_path: Vec<Value>) -> Result<(), GraphQLError> {
        let error = EnhancedGraphQLError::new(message, ErrorCategory::FieldResolution)
            .with_severity(ErrorSeverity::Medium)
            .with_path(field_path);
        self.add_error(error)
    }

    /// Check if there are any errors
    pub fn has_errors(&self) -> bool {
        !self.errors.is_empty()
    }

    /// Get the number of errors
    pub fn len(&self) -> usize {
        self.errors.len()
    }

    /// Check if collection is empty
    pub fn is_empty(&self) -> bool {
        self.errors.is_empty()
    }

    /// Get errors by category
    pub fn get_errors_by_category(&self, category: ErrorCategory) -> Vec<&EnhancedGraphQLError> {
        self.errors.iter().filter(|e| e.category == category).collect()
    }

    /// Get errors by severity
    pub fn get_errors_by_severity(&self, severity: ErrorSeverity) -> Vec<&EnhancedGraphQLError> {
        self.errors.iter().filter(|e| e.severity == severity).collect()
    }

    /// Check if there are any critical errors
    pub fn has_critical_errors(&self) -> bool {
        self.errors.iter().any(|e| e.severity == ErrorSeverity::Critical)
    }

    /// Get the highest severity error
    pub fn highest_severity(&self) -> Option<ErrorSeverity> {
        self.errors.iter().map(|e| &e.severity).max_by(|a, b| {
            use ErrorSeverity::*;
            match (a, b) {
                (Critical, _) => std::cmp::Ordering::Greater,
                (_, Critical) => std::cmp::Ordering::Less,
                (High, _) => std::cmp::Ordering::Greater,
                (_, High) => std::cmp::Ordering::Less,
                (Medium, Low) => std::cmp::Ordering::Greater,
                (Low, Medium) => std::cmp::Ordering::Less,
                _ => std::cmp::Ordering::Equal,
            }
        }).cloned()
    }

    /// Convert to a vector of GraphQLError for response
    pub fn to_graphql_errors(self) -> Vec<GraphQLError> {
        self.errors.into_iter().map(|e| e.to_graphql_error()).collect()
    }

    /// Clear all errors
    pub fn clear(&mut self) {
        self.errors.clear();
    }

    /// Get first error (useful for fail-fast scenarios)
    pub fn first_error(&self) -> Option<&EnhancedGraphQLError> {
        self.errors.front()
    }

    /// Take all errors, leaving the collection empty
    pub fn take_errors(&mut self) -> Vec<EnhancedGraphQLError> {
        self.errors.drain(..).collect()
    }
}

impl Default for GraphQLErrorCollection {
    fn default() -> Self {
        Self::new()
    }
}

impl fmt::Debug for GraphQLErrorCollection {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("GraphQLErrorCollection")
            .field("error_count", &self.errors.len())
            .field("max_errors", &self.max_errors)
            .field("fail_fast", &self.fail_fast)
            .field("errors", &self.errors)
            .finish()
    }
}

/// Utility for building execution paths
#[derive(Debug, Clone, Default)]
pub struct ExecutionPathBuilder {
    path: Vec<Value>,
}

impl ExecutionPathBuilder {
    pub fn new() -> Self {
        Self { path: Vec::new() }
    }

    pub fn with_field(mut self, field_name: impl Into<String>) -> Self {
        self.path.push(Value::String(field_name.into()));
        self
    }

    pub fn with_index(mut self, index: usize) -> Self {
        self.path.push(Value::Number(index.into()));
        self
    }

    pub fn push_field(&mut self, field_name: impl Into<String>) {
        self.path.push(Value::String(field_name.into()));
    }

    pub fn push_index(&mut self, index: usize) {
        self.path.push(Value::Number(index.into()));
    }

    pub fn pop(&mut self) -> Option<Value> {
        self.path.pop()
    }

    pub fn build(self) -> Vec<Value> {
        self.path
    }

    pub fn current_path(&self) -> Vec<Value> {
        self.path.clone()
    }

    pub fn is_empty(&self) -> bool {
        self.path.is_empty()
    }

    pub fn len(&self) -> usize {
        self.path.len()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_enhanced_error_creation() {
        let error = EnhancedGraphQLError::new("Test error", ErrorCategory::Validation)
            .with_severity(ErrorSeverity::High)
            .with_location(10, 5);

        assert_eq!(error.error.message, "Test error");
        assert_eq!(error.category, ErrorCategory::Validation);
        assert_eq!(error.severity, ErrorSeverity::High);
        assert!(error.error.locations.is_some());
    }

    #[test]
    fn test_error_collection_basic() {
        let mut collection = GraphQLErrorCollection::new();
        
        assert!(collection.is_empty());
        assert!(!collection.has_errors());

        let error = EnhancedGraphQLError::new("Test error", ErrorCategory::Execution);
        collection.add_error(error).unwrap();

        assert!(!collection.is_empty());
        assert!(collection.has_errors());
        assert_eq!(collection.len(), 1);
    }

    #[test]
    fn test_error_collection_fail_fast() {
        let mut collection = GraphQLErrorCollection::new_fail_fast();
        
        let error = EnhancedGraphQLError::new("Test error", ErrorCategory::Execution);
        let result = collection.add_error(error);

        assert!(result.is_err());
        assert_eq!(collection.len(), 1);
    }

    #[test]
    fn test_error_collection_max_errors() {
        let mut collection = GraphQLErrorCollection::new().with_max_errors(2);
        
        // Add two errors
        collection.add_error(EnhancedGraphQLError::new("Error 1", ErrorCategory::Execution)).unwrap();
        collection.add_error(EnhancedGraphQLError::new("Error 2", ErrorCategory::Execution)).unwrap();
        
        assert_eq!(collection.len(), 2);
        
        // Add third error - should remove the first one
        collection.add_error(EnhancedGraphQLError::new("Error 3", ErrorCategory::Execution)).unwrap();
        
        assert_eq!(collection.len(), 2);
    }

    #[test]
    fn test_error_filtering() {
        let mut collection = GraphQLErrorCollection::new();
        
        collection.add_error(EnhancedGraphQLError::new("Syntax", ErrorCategory::Syntax)).unwrap();
        collection.add_error(EnhancedGraphQLError::new("Validation", ErrorCategory::Validation)).unwrap();
        collection.add_error(EnhancedGraphQLError::new("Execution", ErrorCategory::Execution)).unwrap();

        let syntax_errors = collection.get_errors_by_category(ErrorCategory::Syntax);
        assert_eq!(syntax_errors.len(), 1);
        assert_eq!(syntax_errors[0].error.message, "Syntax");

        let validation_errors = collection.get_errors_by_category(ErrorCategory::Validation);
        assert_eq!(validation_errors.len(), 1);
        assert_eq!(validation_errors[0].error.message, "Validation");
    }

    #[test]
    fn test_severity_handling() {
        let mut collection = GraphQLErrorCollection::new();
        
        collection.add_error(
            EnhancedGraphQLError::new("Low", ErrorCategory::Execution)
                .with_severity(ErrorSeverity::Low)
        ).unwrap();
        
        collection.add_error(
            EnhancedGraphQLError::new("Critical", ErrorCategory::Execution)
                .with_severity(ErrorSeverity::Critical)
        ).unwrap();

        assert!(collection.has_critical_errors());
        assert_eq!(collection.highest_severity(), Some(ErrorSeverity::Critical));

        let critical_errors = collection.get_errors_by_severity(ErrorSeverity::Critical);
        assert_eq!(critical_errors.len(), 1);
        assert_eq!(critical_errors[0].error.message, "Critical");
    }

    #[test]
    fn test_execution_path_builder() {
        let path = ExecutionPathBuilder::new()
            .with_field("user")
            .with_field("posts")
            .with_index(0)
            .with_field("title")
            .build();

        assert_eq!(path.len(), 4);
        assert_eq!(path[0], Value::String("user".to_string()));
        assert_eq!(path[1], Value::String("posts".to_string()));
        assert_eq!(path[2], Value::Number(0.into()));
        assert_eq!(path[3], Value::String("title".to_string()));
    }

    #[test]
    fn test_path_builder_mutation() {
        let mut builder = ExecutionPathBuilder::new();
        
        builder.push_field("mutation");
        builder.push_field("createUser");
        assert_eq!(builder.len(), 2);

        let popped = builder.pop();
        assert_eq!(popped, Some(Value::String("createUser".to_string())));
        assert_eq!(builder.len(), 1);
    }

    #[test]
    fn test_error_to_graphql_conversion() {
        let error = EnhancedGraphQLError::new("Test error", ErrorCategory::Validation)
            .with_severity(ErrorSeverity::High)
            .with_source("test_module");

        let graphql_error = error.to_graphql_error();
        
        assert_eq!(graphql_error.message, "Test error");
        assert!(graphql_error.extensions.is_some());
        
        if let Some(Value::Object(extensions)) = graphql_error.extensions {
            assert_eq!(extensions.get("category"), Some(&Value::String("Validation".to_string())));
            assert_eq!(extensions.get("severity"), Some(&Value::String("High".to_string())));
            assert_eq!(extensions.get("source"), Some(&Value::String("test_module".to_string())));
        }
    }
}