use crate::graphql::{
    GraphQLError, GraphQLSchema, Document, FragmentDefinition,
    Value as AstValue, OperationDefinition,
    ast::Type as AstType,
};
use serde_json::Value;
use std::collections::HashMap;
use std::rc::Rc;

/// Represents the execution path in the GraphQL query
#[derive(Debug, Clone)]
pub struct ExecutionPath {
    segments: Vec<PathSegment>,
}

#[derive(Debug, Clone)]
pub enum PathSegment {
    Field(String),
    Index(usize),
}

impl ExecutionPath {
    pub fn new() -> Self {
        Self {
            segments: Vec::new(),
        }
    }
    
    pub fn push_field(&mut self, field_name: String) {
        self.segments.push(PathSegment::Field(field_name));
    }
    
    pub fn push_index(&mut self, index: usize) {
        self.segments.push(PathSegment::Index(index));
    }
    
    pub fn pop(&mut self) -> Option<PathSegment> {
        self.segments.pop()
    }
    
    pub fn to_vec(&self) -> Vec<Value> {
        self.segments
            .iter()
            .map(|segment| match segment {
                PathSegment::Field(name) => Value::String(name.clone()),
                PathSegment::Index(idx) => Value::Number((*idx).into()),
            })
            .collect()
    }
    
    pub fn clone_with_field(&self, field_name: String) -> Self {
        let mut new_path = self.clone();
        new_path.push_field(field_name);
        new_path
    }
    
    pub fn clone_with_index(&self, index: usize) -> Self {
        let mut new_path = self.clone();
        new_path.push_index(index);
        new_path
    }
}

impl Default for ExecutionPath {
    fn default() -> Self {
        Self::new()
    }
}

/// Manages variable definitions and resolution during execution
#[derive(Debug, Clone)]
pub struct VariableManager {
    definitions: HashMap<String, VariableDefinition>,
    values: HashMap<String, Value>,
}

#[derive(Debug, Clone)]
pub struct VariableDefinition {
    pub name: String,
    pub type_: AstType,
    pub default_value: Option<AstValue>,
}

impl VariableManager {
    pub fn new() -> Self {
        Self {
            definitions: HashMap::new(),
            values: HashMap::new(),
        }
    }
    
    pub fn add_definition(&mut self, var_def: VariableDefinition) {
        self.definitions.insert(var_def.name.clone(), var_def);
    }
    
    pub fn set_value(&mut self, name: String, value: Value) {
        self.values.insert(name, value);
    }
    
    pub fn get_value(&self, name: &str) -> Result<Value, GraphQLError> {
        if let Some(value) = self.values.get(name) {
            Ok(value.clone())
        } else if let Some(definition) = self.definitions.get(name) {
            // Check if variable has a default value
            if let Some(default_value) = &definition.default_value {
                self.resolve_ast_value(default_value)
            } else {
                Err(GraphQLError::new(
                    format!("Variable '{}' is required but not provided", name)
                ))
            }
        } else {
            Err(GraphQLError::new(
                format!("Variable '{}' is not defined", name)
            ))
        }
    }
    
    pub fn has_variable(&self, name: &str) -> bool {
        self.definitions.contains_key(name)
    }
    
    pub fn validate_variables(&self) -> Result<(), Vec<GraphQLError>> {
        let mut errors = Vec::new();
        
        for (name, definition) in &self.definitions {
            // Check if required variables are provided
            if definition.type_.is_non_null() && 
               !self.values.contains_key(name) && 
               definition.default_value.is_none() {
                errors.push(GraphQLError::new(
                    format!("Required variable '{}' is not provided", name)
                ));
            }
            
            // Validate provided values against their types
            if let Some(value) = self.values.get(name) {
                if let Err(error) = self.validate_variable_value(value, &definition.type_) {
                    errors.push(error);
                }
            }
        }
        
        if errors.is_empty() {
            Ok(())
        } else {
            Err(errors)
        }
    }
    
    fn resolve_ast_value(&self, value: &AstValue) -> Result<Value, GraphQLError> {
        match value {
            AstValue::Variable(var) => self.get_value(&var.name),
            AstValue::IntValue(i) => Ok(Value::Number((*i).into())),
            AstValue::FloatValue(f) => Ok(Value::Number(
                serde_json::Number::from_f64(*f)
                    .unwrap_or_else(|| serde_json::Number::from(0))
            )),
            AstValue::StringValue(s) => Ok(Value::String(s.clone())),
            AstValue::BooleanValue(b) => Ok(Value::Bool(*b)),
            AstValue::NullValue => Ok(Value::Null),
            AstValue::EnumValue(e) => Ok(Value::String(e.clone())),
            AstValue::ListValue(list) => {
                let mut result = Vec::new();
                for item in list {
                    result.push(self.resolve_ast_value(item)?);
                }
                Ok(Value::Array(result))
            }
            AstValue::ObjectValue(obj) => {
                let mut result = serde_json::Map::new();
                for (key, val) in obj {
                    result.insert(key.clone(), self.resolve_ast_value(val)?);
                }
                Ok(Value::Object(result))
            }
        }
    }
    
    fn validate_variable_value(&self, _value: &Value, _type_: &AstType) -> Result<(), GraphQLError> {
        // For now, we'll do basic validation
        // In a full implementation, we would validate the value against the GraphQL type
        Ok(())
    }
}

/// Fragment manager for handling fragment definitions and spreads
#[derive(Debug, Clone)]
pub struct FragmentManager {
    fragments: HashMap<String, Rc<FragmentDefinition>>,
}

impl FragmentManager {
    pub fn new() -> Self {
        Self {
            fragments: HashMap::new(),
        }
    }
    
    pub fn add_fragment(&mut self, fragment: FragmentDefinition) {
        self.fragments.insert(fragment.name.clone(), Rc::new(fragment));
    }
    
    pub fn get_fragment(&self, name: &str) -> Option<Rc<FragmentDefinition>> {
        self.fragments.get(name).cloned()
    }
    
    pub fn has_fragment(&self, name: &str) -> bool {
        self.fragments.contains_key(name)
    }
    
    pub fn validate_fragments(&self, schema: &GraphQLSchema) -> Result<(), Vec<GraphQLError>> {
        let mut errors = Vec::new();
        
        for fragment in self.fragments.values() {
            // Validate that the fragment's type condition exists in the schema
            if !schema.types.contains_key(&fragment.type_condition) {
                errors.push(GraphQLError::new(
                    format!("Fragment '{}' references unknown type '{}'", 
                           fragment.name, fragment.type_condition)
                ));
            }
        }
        
        if errors.is_empty() {
            Ok(())
        } else {
            Err(errors)
        }
    }
}

/// Main execution context that manages the state during GraphQL execution
#[derive(Debug)]
pub struct ExecutionContext {
    pub schema: Rc<GraphQLSchema>,
    pub document: Rc<Document>,
    pub operation: Rc<OperationDefinition>,
    pub variables: VariableManager,
    pub fragments: FragmentManager,
    pub path: ExecutionPath,
    pub errors: Vec<GraphQLError>,
    pub parent_value: Option<Value>,
    pub current_type: Option<String>,
}

impl ExecutionContext {
    pub fn new(
        schema: Rc<GraphQLSchema>,
        document: Rc<Document>,
        operation: Rc<OperationDefinition>,
        variables: HashMap<String, Value>,
    ) -> Result<Self, Vec<GraphQLError>> {
        let mut variable_manager = VariableManager::new();
        let mut fragment_manager = FragmentManager::new();
        let mut errors = Vec::new();
        
        // Collect variable definitions from the operation
        for var_def in &operation.variable_definitions {
            variable_manager.add_definition(VariableDefinition {
                name: var_def.variable.name.clone(),
                type_: var_def.type_.clone(),
                default_value: var_def.default_value.clone(),
            });
        }
        
        // Set provided variable values
        for (name, value) in variables {
            variable_manager.set_value(name, value);
        }
        
        // Validate variables
        if let Err(var_errors) = variable_manager.validate_variables() {
            errors.extend(var_errors);
        }
        
        // Collect fragments from the document
        for definition in &document.definitions {
            if let crate::graphql::Definition::Fragment(fragment) = definition {
                fragment_manager.add_fragment(fragment.clone());
            }
        }
        
        // Validate fragments
        if let Err(frag_errors) = fragment_manager.validate_fragments(&schema) {
            errors.extend(frag_errors);
        }
        
        // Determine the root type for the operation
        let current_type = match operation.operation_type {
            crate::graphql::ast::OperationType::Query => Some(schema.query_type.name.clone()),
            crate::graphql::ast::OperationType::Mutation => {
                schema.mutation_type.as_ref().map(|t| t.name.clone())
            }
            crate::graphql::ast::OperationType::Subscription => {
                schema.subscription_type.as_ref().map(|t| t.name.clone())
            }
        };
        
        if current_type.is_none() {
            errors.push(GraphQLError::new(
                format!("Schema does not support {:?} operations", operation.operation_type)
            ));
        }
        
        let context = Self {
            schema,
            document,
            operation,
            variables: variable_manager,
            fragments: fragment_manager,
            path: ExecutionPath::new(),
            errors,
            parent_value: None,
            current_type,
        };
        
        if context.errors.is_empty() {
            Ok(context)
        } else {
            Err(context.errors)
        }
    }
    
    /// Create a child context for field execution
    pub fn create_field_context(&self, field_name: String, field_type: String, parent_value: Option<Value>) -> Self {
        Self {
            schema: self.schema.clone(),
            document: self.document.clone(),
            operation: self.operation.clone(),
            variables: self.variables.clone(),
            fragments: self.fragments.clone(),
            path: self.path.clone_with_field(field_name),
            errors: Vec::new(),
            parent_value,
            current_type: Some(field_type),
        }
    }
    
    /// Create a child context for list item execution
    pub fn create_list_item_context(&self, index: usize, item_type: String, item_value: Option<Value>) -> Self {
        Self {
            schema: self.schema.clone(),
            document: self.document.clone(),
            operation: self.operation.clone(),
            variables: self.variables.clone(),
            fragments: self.fragments.clone(),
            path: self.path.clone_with_index(index),
            errors: Vec::new(),
            parent_value: item_value,
            current_type: Some(item_type),
        }
    }
    
    /// Resolve a variable value by name
    pub fn resolve_variable(&self, name: &str) -> Result<Value, GraphQLError> {
        self.variables.get_value(name)
    }
    
    /// Resolve an AST value with variable substitution
    pub fn resolve_value(&self, value: &AstValue) -> Result<Value, GraphQLError> {
        self.variables.resolve_ast_value(value)
    }
    
    /// Get a fragment definition by name
    pub fn get_fragment(&self, name: &str) -> Option<Rc<FragmentDefinition>> {
        self.fragments.get_fragment(name)
    }
    
    /// Add an error to the context
    pub fn add_error(&mut self, error: GraphQLError) {
        let error_with_path = error.with_path(self.path.to_vec());
        self.errors.push(error_with_path);
    }
    
    /// Get all errors from this context
    pub fn get_errors(&self) -> &[GraphQLError] {
        &self.errors
    }
    
    /// Check if the current type is a composite type
    pub fn is_composite_type(&self) -> bool {
        if let Some(type_name) = &self.current_type {
            if let Some(type_def) = self.schema.get_type(type_name) {
                match type_def {
                    crate::graphql::GraphQLType::Object(_) |
                    crate::graphql::GraphQLType::Interface(_) |
                    crate::graphql::GraphQLType::Union(_) => true,
                    _ => false,
                }
            } else {
                false
            }
        } else {
            false
        }
    }
    
    /// Check if the current type is a leaf type (scalar or enum)
    pub fn is_leaf_type(&self) -> bool {
        if let Some(type_name) = &self.current_type {
            if let Some(type_def) = self.schema.get_type(type_name) {
                match type_def {
                    crate::graphql::GraphQLType::Scalar(_) |
                    crate::graphql::GraphQLType::Enum(_) => true,
                    _ => false,
                }
            } else {
                false
            }
        } else {
            false
        }
    }
    
    /// Get the current execution path as a string for debugging
    pub fn path_string(&self) -> String {
        self.path
            .segments
            .iter()
            .map(|segment| match segment {
                PathSegment::Field(name) => name.clone(),
                PathSegment::Index(idx) => format!("[{}]", idx),
            })
            .collect::<Vec<_>>()
            .join(".")
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::graphql::{
        ast::{Document, Definition, OperationDefinition, OperationType, SelectionSet, VariableDefinition as AstVariableDefinition, Variable as AstVariable},
        schema::{GraphQLSchema, ObjectType, ScalarType, GraphQLType, Field as SchemaField},
        lexer::Position,
    };
    
    fn create_test_schema() -> GraphQLSchema {
        let string_type = GraphQLType::Scalar(ScalarType::string());
        let int_type = GraphQLType::Scalar(ScalarType::int());
        
        let user_type = ObjectType::new("User")
            .add_field("id", SchemaField::new(string_type.clone()))
            .add_field("name", SchemaField::new(string_type.clone()))
            .add_field("age", SchemaField::new(int_type.clone()));
        
        let query_type = ObjectType::new("Query")
            .add_field("user", SchemaField::new(GraphQLType::Object(user_type.clone())));
        
        let mut schema = GraphQLSchema::new(query_type);
        schema.add_type("User".to_string(), GraphQLType::Object(user_type));
        schema
    }
    
    fn create_test_operation() -> OperationDefinition {
        OperationDefinition::new(
            OperationType::Query,
            None,
            vec![AstVariableDefinition {
                variable: AstVariable {
                    name: "userId".to_string(),
                    position: Position::new(),
                },
                type_: AstType::Named("String".to_string()),
                default_value: None,
                directives: vec![],
                position: Position::new(),
            }],
            vec![],
            SelectionSet::new(vec![], Position::new()),
            Position::new(),
        )
    }
    
    #[test]
    fn test_execution_path() {
        let mut path = ExecutionPath::new();
        
        path.push_field("user".to_string());
        path.push_field("name".to_string());
        path.push_index(0);
        
        let path_vec = path.to_vec();
        assert_eq!(path_vec.len(), 3);
        assert_eq!(path_vec[0], Value::String("user".to_string()));
        assert_eq!(path_vec[1], Value::String("name".to_string()));
        assert_eq!(path_vec[2], Value::Number(0.into()));
        
        let popped = path.pop();
        assert!(matches!(popped, Some(PathSegment::Index(0))));
    }
    
    #[test]
    fn test_variable_manager() {
        let mut var_manager = VariableManager::new();
        
        // Add a variable definition
        var_manager.add_definition(VariableDefinition {
            name: "userId".to_string(),
            type_: AstType::Named("String".to_string()),
            default_value: None,
        });
        
        // Set a variable value
        var_manager.set_value("userId".to_string(), Value::String("123".to_string()));
        
        // Retrieve the variable value
        let value = var_manager.get_value("userId").unwrap();
        assert_eq!(value, Value::String("123".to_string()));
        
        // Test undefined variable
        let error = var_manager.get_value("unknownVar").unwrap_err();
        assert!(error.message.contains("not defined"));
    }
    
    #[test]
    fn test_fragment_manager() {
        let mut frag_manager = FragmentManager::new();
        
        let fragment = FragmentDefinition {
            name: "UserFields".to_string(),
            type_condition: "User".to_string(),
            directives: vec![],
            selection_set: SelectionSet::new(vec![], Position::new()),
            position: Position::new(),
        };
        
        frag_manager.add_fragment(fragment);
        
        assert!(frag_manager.has_fragment("UserFields"));
        assert!(!frag_manager.has_fragment("UnknownFragment"));
        
        let retrieved_fragment = frag_manager.get_fragment("UserFields");
        assert!(retrieved_fragment.is_some());
        assert_eq!(retrieved_fragment.unwrap().name, "UserFields");
    }
    
    #[test]
    fn test_execution_context_creation() {
        let schema = Rc::new(create_test_schema());
        let operation = Rc::new(create_test_operation());
        let document = Rc::new(Document::new(vec![Definition::Operation((*operation).clone())]));
        
        let mut variables = HashMap::new();
        variables.insert("userId".to_string(), Value::String("123".to_string()));
        
        let context = ExecutionContext::new(schema, document, operation, variables);
        assert!(context.is_ok());
        
        let context = context.unwrap();
        assert_eq!(context.current_type, Some("Query".to_string()));
        assert!(context.errors.is_empty());
    }
    
    #[test]
    fn test_execution_context_child_creation() {
        let schema = Rc::new(create_test_schema());
        let operation = Rc::new(create_test_operation());
        let document = Rc::new(Document::new(vec![Definition::Operation((*operation).clone())]));
        
        let variables = HashMap::new();
        let context = ExecutionContext::new(schema, document, operation, variables).unwrap();
        
        let field_context = context.create_field_context(
            "user".to_string(),
            "User".to_string(),
            Some(Value::String("test".to_string())),
        );
        
        assert_eq!(field_context.current_type, Some("User".to_string()));
        assert_eq!(field_context.parent_value, Some(Value::String("test".to_string())));
        assert_eq!(field_context.path_string(), "user");
    }
    
    #[test]
    fn test_variable_resolution() {
        let schema = Rc::new(create_test_schema());
        let operation = Rc::new(create_test_operation());
        let document = Rc::new(Document::new(vec![Definition::Operation((*operation).clone())]));
        
        let mut variables = HashMap::new();
        variables.insert("userId".to_string(), Value::String("123".to_string()));
        
        let context = ExecutionContext::new(schema, document, operation, variables).unwrap();
        
        let resolved = context.resolve_variable("userId").unwrap();
        assert_eq!(resolved, Value::String("123".to_string()));
        
        let error = context.resolve_variable("unknownVar").unwrap_err();
        assert!(error.message.contains("not defined"));
    }
}