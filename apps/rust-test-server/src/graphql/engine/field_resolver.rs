use crate::graphql::{
    GraphQLError, GraphQLValue, ExecutionContext,
    ast::{Field as AstField},
    schema::{GraphQLType, GraphQLSchema, Field as SchemaField},
};
use serde_json::Value;
use std::collections::HashMap;
use std::future::Future;
use std::pin::Pin;
use std::rc::Rc;

/// Resolution information provided to field resolvers
#[derive(Debug, Clone)]
pub struct FieldResolutionInfo {
    /// The field being resolved
    pub field_name: String,
    /// Arguments passed to the field
    pub arguments: HashMap<String, Value>,
    /// The parent object being resolved from
    pub parent_value: Option<Value>,
    /// The field's return type according to the schema
    pub return_type: GraphQLType,
    /// Path to this field in the query
    pub path: Vec<Value>,
}

/// Context for field resolution that extends ExecutionContext
#[derive(Debug)]
pub struct FieldContext {
    pub execution_context: Rc<ExecutionContext>,
    pub field_info: FieldResolutionInfo,
    pub schema_field: SchemaField,
}

impl FieldContext {
    pub fn new(
        execution_context: Rc<ExecutionContext>,
        field: &AstField,
        schema_field: SchemaField,
        parent_value: Option<Value>,
    ) -> Result<Self, GraphQLError> {
        // Resolve field arguments
        let mut resolved_args = HashMap::new();
        for arg in &field.arguments {
            let resolved_value = execution_context.resolve_value(&arg.value)?;
            resolved_args.insert(arg.name.clone(), resolved_value);
        }

        let field_info = FieldResolutionInfo {
            field_name: field.name.clone(),
            arguments: resolved_args,
            parent_value,
            return_type: schema_field.field_type.clone(),
            path: execution_context.path.to_vec(),
        };

        Ok(Self {
            execution_context,
            field_info,
            schema_field,
        })
    }

    /// Get an argument value by name
    pub fn get_argument(&self, name: &str) -> Option<&Value> {
        self.field_info.arguments.get(name)
    }

    /// Get an argument value by name with type conversion
    pub fn get_argument_as<T>(&self, name: &str) -> Result<Option<T>, GraphQLError>
    where
        T: serde::de::DeserializeOwned,
    {
        match self.get_argument(name) {
            Some(value) => {
                match serde_json::from_value(value.clone()) {
                    Ok(typed_value) => Ok(Some(typed_value)),
                    Err(err) => Err(GraphQLError::new(
                        format!("Failed to convert argument '{}': {}", name, err)
                    ))
                }
            }
            None => Ok(None),
        }
    }

    /// Get the parent value with type conversion
    pub fn get_parent<T>(&self) -> Result<Option<T>, GraphQLError>
    where
        T: serde::de::DeserializeOwned,
    {
        match &self.field_info.parent_value {
            Some(value) => {
                match serde_json::from_value(value.clone()) {
                    Ok(typed_value) => Ok(Some(typed_value)),
                    Err(err) => Err(GraphQLError::new(
                        format!("Failed to convert parent value: {}", err)
                    ))
                }
            }
            None => Ok(None),
        }
    }

    /// Check if a field argument is provided
    pub fn has_argument(&self, name: &str) -> bool {
        self.field_info.arguments.contains_key(name)
    }
}

/// Result type for field resolution that can be either sync or async
pub type FieldResult = Result<GraphQLValue, GraphQLError>;
pub type AsyncFieldResult = Pin<Box<dyn Future<Output = FieldResult> + Send>>;

/// Trait for field resolvers that support both sync and async resolution
pub trait FieldResolver: Send + Sync {
    /// Resolve a field synchronously
    fn resolve_sync(&self, _context: &FieldContext) -> FieldResult {
        Err(GraphQLError::new("Synchronous resolution not implemented"))
    }

    /// Resolve a field asynchronously
    fn resolve_async(&self, _context: FieldContext) -> AsyncFieldResult {
        Box::pin(async move {
            Err(GraphQLError::new("Asynchronous resolution not implemented"))
        })
    }

    /// Check if this resolver supports async resolution
    fn is_async(&self) -> bool {
        false
    }
}

/// A synchronous field resolver function
pub type SyncResolverFn = Box<dyn Fn(&FieldContext) -> FieldResult + Send + Sync>;

/// An asynchronous field resolver function
pub type AsyncResolverFn = Box<dyn Fn(FieldContext) -> AsyncFieldResult + Send + Sync>;

/// Synchronous field resolver implementation
pub struct SyncFieldResolver {
    resolver_fn: SyncResolverFn,
}

impl SyncFieldResolver {
    pub fn new<F>(resolver: F) -> Self
    where
        F: Fn(&FieldContext) -> FieldResult + Send + Sync + 'static,
    {
        Self {
            resolver_fn: Box::new(resolver),
        }
    }
}

impl FieldResolver for SyncFieldResolver {
    fn resolve_sync(&self, context: &FieldContext) -> FieldResult {
        (self.resolver_fn)(context)
    }
}

/// Asynchronous field resolver implementation
pub struct AsyncFieldResolver {
    resolver_fn: AsyncResolverFn,
}

impl AsyncFieldResolver {
    pub fn new<F, Fut>(resolver: F) -> Self
    where
        F: Fn(FieldContext) -> Fut + Send + Sync + 'static,
        Fut: Future<Output = FieldResult> + Send + 'static,
    {
        let resolver_fn = Box::new(move |context: FieldContext| -> AsyncFieldResult {
            Box::pin(resolver(context))
        });

        Self { resolver_fn }
    }
}

impl FieldResolver for AsyncFieldResolver {
    fn resolve_async(&self, context: FieldContext) -> AsyncFieldResult {
        (self.resolver_fn)(context)
    }

    fn is_async(&self) -> bool {
        true
    }
}

/// Built-in scalar resolvers
pub struct ScalarResolvers;

impl ScalarResolvers {
    /// String scalar resolver
    pub fn string() -> SyncFieldResolver {
        SyncFieldResolver::new(|context| {
            match &context.field_info.parent_value {
                Some(Value::String(s)) => Ok(GraphQLValue::String(s.clone())),
                Some(Value::Number(n)) => Ok(GraphQLValue::String(n.to_string())),
                Some(Value::Bool(b)) => Ok(GraphQLValue::String(b.to_string())),
                Some(Value::Null) => Ok(GraphQLValue::Null),
                Some(value) => Ok(GraphQLValue::String(value.to_string())),
                None => Ok(GraphQLValue::Null),
            }
        })
    }

    /// Int scalar resolver
    pub fn int() -> SyncFieldResolver {
        SyncFieldResolver::new(|context| {
            match &context.field_info.parent_value {
                Some(Value::Number(n)) => {
                    if let Some(i) = n.as_i64() {
                        Ok(GraphQLValue::Int(i))
                    } else {
                        Err(GraphQLError::new("Number is not a valid integer"))
                    }
                }
                Some(Value::String(s)) => {
                    match s.parse::<i64>() {
                        Ok(i) => Ok(GraphQLValue::Int(i)),
                        Err(_) => Err(GraphQLError::new("String cannot be converted to integer")),
                    }
                }
                Some(Value::Null) => Ok(GraphQLValue::Null),
                Some(_) => Err(GraphQLError::new("Value cannot be converted to integer")),
                None => Ok(GraphQLValue::Null),
            }
        })
    }

    /// Float scalar resolver
    pub fn float() -> SyncFieldResolver {
        SyncFieldResolver::new(|context| {
            match &context.field_info.parent_value {
                Some(Value::Number(n)) => {
                    if let Some(f) = n.as_f64() {
                        Ok(GraphQLValue::Float(f))
                    } else {
                        Ok(GraphQLValue::Float(0.0))
                    }
                }
                Some(Value::String(s)) => {
                    match s.parse::<f64>() {
                        Ok(f) => Ok(GraphQLValue::Float(f)),
                        Err(_) => Err(GraphQLError::new("String cannot be converted to float")),
                    }
                }
                Some(Value::Null) => Ok(GraphQLValue::Null),
                Some(_) => Err(GraphQLError::new("Value cannot be converted to float")),
                None => Ok(GraphQLValue::Null),
            }
        })
    }

    /// Boolean scalar resolver
    pub fn boolean() -> SyncFieldResolver {
        SyncFieldResolver::new(|context| {
            match &context.field_info.parent_value {
                Some(Value::Bool(b)) => Ok(GraphQLValue::Boolean(*b)),
                Some(Value::String(s)) => {
                    match s.to_lowercase().as_str() {
                        "true" | "1" | "yes" => Ok(GraphQLValue::Boolean(true)),
                        "false" | "0" | "no" => Ok(GraphQLValue::Boolean(false)),
                        _ => Err(GraphQLError::new("String cannot be converted to boolean")),
                    }
                }
                Some(Value::Number(n)) => {
                    if let Some(i) = n.as_i64() {
                        Ok(GraphQLValue::Boolean(i != 0))
                    } else {
                        Ok(GraphQLValue::Boolean(n.as_f64().unwrap_or(0.0) != 0.0))
                    }
                }
                Some(Value::Null) => Ok(GraphQLValue::Null),
                Some(_) => Err(GraphQLError::new("Value cannot be converted to boolean")),
                None => Ok(GraphQLValue::Null),
            }
        })
    }

    /// ID scalar resolver
    pub fn id() -> SyncFieldResolver {
        SyncFieldResolver::new(|context| {
            match &context.field_info.parent_value {
                Some(Value::String(s)) => Ok(GraphQLValue::String(s.clone())),
                Some(Value::Number(n)) => Ok(GraphQLValue::String(n.to_string())),
                Some(Value::Null) => Ok(GraphQLValue::Null),
                Some(value) => Ok(GraphQLValue::String(value.to_string())),
                None => Ok(GraphQLValue::Null),
            }
        })
    }
}

/// Object field resolver that extracts fields from parent objects
pub struct ObjectFieldResolver {
    field_name: String,
}

impl ObjectFieldResolver {
    pub fn new(field_name: String) -> Self {
        Self { field_name }
    }
}

impl FieldResolver for ObjectFieldResolver {
    fn resolve_sync(&self, context: &FieldContext) -> FieldResult {
        match &context.field_info.parent_value {
            Some(Value::Object(obj)) => {
                if let Some(field_value) = obj.get(&self.field_name) {
                    Ok(field_value.clone().into())
                } else {
                    Ok(GraphQLValue::Null)
                }
            }
            Some(Value::Null) => Ok(GraphQLValue::Null),
            Some(_) => Err(GraphQLError::new(
                format!("Cannot extract field '{}' from non-object value", self.field_name)
            )),
            None => Ok(GraphQLValue::Null),
        }
    }
}

/// List field resolver that handles array values
pub struct ListFieldResolver {
    item_resolver: Box<dyn FieldResolver>,
}

impl ListFieldResolver {
    pub fn new(item_resolver: Box<dyn FieldResolver>) -> Self {
        Self { item_resolver }
    }
}

impl FieldResolver for ListFieldResolver {
    fn resolve_sync(&self, context: &FieldContext) -> FieldResult {
        match &context.field_info.parent_value {
            Some(Value::Array(arr)) => {
                let mut resolved_items = Vec::new();
                for (index, item) in arr.iter().enumerate() {
                    // Create a new context for each list item
                    let item_context = FieldContext {
                        execution_context: context.execution_context.clone(),
                        field_info: FieldResolutionInfo {
                            field_name: context.field_info.field_name.clone(),
                            arguments: context.field_info.arguments.clone(),
                            parent_value: Some(item.clone()),
                            return_type: context.field_info.return_type.clone(),
                            path: {
                                let mut path = context.field_info.path.clone();
                                path.push(Value::Number(index.into()));
                                path
                            },
                        },
                        schema_field: context.schema_field.clone(),
                    };

                    let resolved_item = if self.item_resolver.is_async() {
                        return Err(GraphQLError::new("Async list resolution not supported in sync context"));
                    } else {
                        self.item_resolver.resolve_sync(&item_context)?
                    };

                    resolved_items.push(resolved_item);
                }
                Ok(GraphQLValue::List(resolved_items))
            }
            Some(Value::Null) => Ok(GraphQLValue::Null),
            Some(_) => Err(GraphQLError::new("Cannot resolve list from non-array value")),
            None => Ok(GraphQLValue::Null),
        }
    }

    fn is_async(&self) -> bool {
        self.item_resolver.is_async()
    }
}

/// Resolver registry that manages field resolvers for different types
#[derive(Default)]
pub struct ResolverRegistry {
    resolvers: HashMap<String, HashMap<String, Box<dyn FieldResolver>>>,
}

impl ResolverRegistry {
    pub fn new() -> Self {
        let mut registry = Self::default();
        registry.register_built_in_scalars();
        registry
    }

    /// Register built-in scalar resolvers
    fn register_built_in_scalars(&mut self) {
        // String scalar
        self.add_resolver("String", "__resolve", Box::new(ScalarResolvers::string()));
        
        // Int scalar
        self.add_resolver("Int", "__resolve", Box::new(ScalarResolvers::int()));
        
        // Float scalar
        self.add_resolver("Float", "__resolve", Box::new(ScalarResolvers::float()));
        
        // Boolean scalar
        self.add_resolver("Boolean", "__resolve", Box::new(ScalarResolvers::boolean()));
        
        // ID scalar
        self.add_resolver("ID", "__resolve", Box::new(ScalarResolvers::id()));
    }

    /// Add a field resolver for a specific type and field
    pub fn add_resolver(
        &mut self,
        type_name: impl Into<String>,
        field_name: impl Into<String>,
        resolver: Box<dyn FieldResolver>,
    ) {
        let type_name = type_name.into();
        let field_name = field_name.into();
        
        self.resolvers
            .entry(type_name)
            .or_insert_with(HashMap::new)
            .insert(field_name, resolver);
    }

    /// Add a synchronous field resolver
    pub fn add_sync_resolver<F>(
        &mut self,
        type_name: impl Into<String>,
        field_name: impl Into<String>,
        resolver: F,
    )
    where
        F: Fn(&FieldContext) -> FieldResult + Send + Sync + 'static,
    {
        self.add_resolver(
            type_name,
            field_name,
            Box::new(SyncFieldResolver::new(resolver)),
        );
    }

    /// Add an asynchronous field resolver
    pub fn add_async_resolver<F, Fut>(
        &mut self,
        type_name: impl Into<String>,
        field_name: impl Into<String>,
        resolver: F,
    )
    where
        F: Fn(FieldContext) -> Fut + Send + Sync + 'static,
        Fut: Future<Output = FieldResult> + Send + 'static,
    {
        self.add_resolver(
            type_name,
            field_name,
            Box::new(AsyncFieldResolver::new(resolver)),
        );
    }

    /// Get a field resolver for a specific type and field
    pub fn get_resolver(&self, type_name: &str, field_name: &str) -> Option<&dyn FieldResolver> {
        self.resolvers
            .get(type_name)
            .and_then(|type_resolvers| type_resolvers.get(field_name))
            .map(|resolver| resolver.as_ref())
    }

    /// Check if a resolver exists for a type and field
    pub fn has_resolver(&self, type_name: &str, field_name: &str) -> bool {
        self.resolvers
            .get(type_name)
            .map(|type_resolvers| type_resolvers.contains_key(field_name))
            .unwrap_or(false)
    }

    /// Auto-register object field resolvers based on schema
    pub fn auto_register_object_fields(&mut self, schema: &GraphQLSchema) {
        for (type_name, type_def) in &schema.types {
            if let GraphQLType::Object(obj_type) = type_def {
                for field_name in obj_type.fields.keys() {
                    if !self.has_resolver(type_name, field_name) {
                        self.add_resolver(
                            type_name.clone(),
                            field_name.clone(),
                            Box::new(ObjectFieldResolver::new(field_name.clone())),
                        );
                    }
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::graphql::{
        ast::{Document, Definition, OperationDefinition, OperationType, SelectionSet},
        schema::{ObjectType, ScalarType, Field as SchemaField},
        lexer::Position,
    };
    use serde_json::json;
    use std::collections::HashMap;

    fn create_test_execution_context() -> Rc<ExecutionContext> {
        let string_type = GraphQLType::Scalar(ScalarType::string());
        let query_type = ObjectType::new("Query")
            .add_field("hello", SchemaField::new(string_type.clone()));
        let schema = Rc::new(GraphQLSchema::new(query_type));
        
        let operation = Rc::new(OperationDefinition::new(
            OperationType::Query,
            None,
            vec![],
            vec![],
            SelectionSet::new(vec![], Position::new()),
            Position::new(),
        ));
        
        let document = Rc::new(Document::new(vec![Definition::Operation((*operation).clone())]));
        
        Rc::new(ExecutionContext::new(schema, document, operation, HashMap::new()).unwrap())
    }

    #[test]
    fn test_scalar_string_resolver() {
        let execution_context = create_test_execution_context();
        let resolver = ScalarResolvers::string();
        
        let field = AstField::new(
            None,
            "test".to_string(),
            vec![],
            vec![],
            None,
            Position::new(),
        );
        
        let schema_field = SchemaField::new(GraphQLType::Scalar(ScalarType::string()));
        let parent_value = Some(json!("Hello, World!"));
        
        let context = FieldContext::new(execution_context, &field, schema_field, parent_value).unwrap();
        let result = resolver.resolve_sync(&context).unwrap();
        
        assert!(matches!(result, GraphQLValue::String(s) if s == "Hello, World!"));
    }

    #[test]
    fn test_scalar_int_resolver() {
        let execution_context = create_test_execution_context();
        let resolver = ScalarResolvers::int();
        
        let field = AstField::new(
            None,
            "test".to_string(),
            vec![],
            vec![],
            None,
            Position::new(),
        );
        
        let schema_field = SchemaField::new(GraphQLType::Scalar(ScalarType::int()));
        let parent_value = Some(json!(42));
        
        let context = FieldContext::new(execution_context, &field, schema_field, parent_value).unwrap();
        let result = resolver.resolve_sync(&context).unwrap();
        
        assert!(matches!(result, GraphQLValue::Int(42)));
    }

    #[test]
    fn test_object_field_resolver() {
        let execution_context = create_test_execution_context();
        let resolver = ObjectFieldResolver::new("name".to_string());
        
        let field = AstField::new(
            None,
            "name".to_string(),
            vec![],
            vec![],
            None,
            Position::new(),
        );
        
        let schema_field = SchemaField::new(GraphQLType::Scalar(ScalarType::string()));
        let parent_value = Some(json!({"name": "John Doe", "age": 30}));
        
        let context = FieldContext::new(execution_context, &field, schema_field, parent_value).unwrap();
        let result = resolver.resolve_sync(&context).unwrap();
        
        if let GraphQLValue::String(name) = result {
            assert_eq!(name, "John Doe");
        } else {
            panic!("Expected string value");
        }
    }

    #[test]
    fn test_resolver_registry() {
        let mut registry = ResolverRegistry::new();
        
        // Test built-in scalar resolvers
        assert!(registry.has_resolver("String", "__resolve"));
        assert!(registry.has_resolver("Int", "__resolve"));
        assert!(registry.has_resolver("Float", "__resolve"));
        assert!(registry.has_resolver("Boolean", "__resolve"));
        assert!(registry.has_resolver("ID", "__resolve"));
        
        // Test custom resolver
        registry.add_sync_resolver("Query", "hello", |_context| {
            Ok(GraphQLValue::String("Hello, World!".to_string()))
        });
        
        assert!(registry.has_resolver("Query", "hello"));
    }

    #[test]
    fn test_field_context_arguments() {
        let execution_context = create_test_execution_context();
        
        let field = AstField::new(
            None,
            "user".to_string(),
            vec![crate::graphql::ast::Argument {
                name: "id".to_string(),
                value: crate::graphql::ast::Value::StringValue("123".to_string()),
                position: Position::new(),
            }],
            vec![],
            None,
            Position::new(),
        );
        
        let schema_field = SchemaField::new(GraphQLType::Scalar(ScalarType::string()));
        
        let context = FieldContext::new(execution_context, &field, schema_field, None).unwrap();
        
        assert!(context.has_argument("id"));
        assert_eq!(context.get_argument("id"), Some(&json!("123")));
        assert!(!context.has_argument("name"));
    }
}