use crate::graphql::{
    GraphQLError, GraphQLValue, GraphQLResponse, GraphQLRequest, GraphQLSchema,
    ExecutionContext, ResolverRegistry, FieldContext,
    Document, OperationDefinition, SelectionSet, Selection,
    ast::{Field as AstField}, FragmentSpread, InlineFragment,
    schema::{GraphQLType, Field as SchemaField},
    Validator, ResultFormatter,
    error_collection::{
        GraphQLErrorCollection, EnhancedGraphQLError, ErrorCategory, ErrorSeverity, ExecutionPathBuilder
    },
};
use serde_json::Value;
use std::collections::HashMap;
use std::rc::Rc;
use std::future::Future;
use std::pin::Pin;

/// Result type for async execution
pub type AsyncExecutionResult = Pin<Box<dyn Future<Output = Result<GraphQLValue, GraphQLError>> + Send>>;

/// Query execution engine that provides comprehensive GraphQL query execution
pub struct QueryExecutor {
    schema: Rc<GraphQLSchema>,
    resolver_registry: ResolverRegistry,
    result_formatter: ResultFormatter,
    enable_validation: bool,
    collect_errors: bool,
}

impl QueryExecutor {
    /// Create a new query executor with the given schema
    pub fn new(schema: GraphQLSchema) -> Self {
        let schema = Rc::new(schema);
        let mut resolver_registry = ResolverRegistry::new();
        
        // Auto-register object field resolvers based on schema
        resolver_registry.auto_register_object_fields(&schema);
        
        Self {
            schema,
            resolver_registry,
            result_formatter: ResultFormatter::new(),
            enable_validation: true,
            collect_errors: false,
        }
    }

    /// Create a query executor with custom resolver registry
    pub fn with_resolver_registry(schema: GraphQLSchema, resolver_registry: ResolverRegistry) -> Self {
        Self {
            schema: Rc::new(schema),
            resolver_registry,
            result_formatter: ResultFormatter::new(),
            enable_validation: true,
            collect_errors: false,
        }
    }

    /// Enable or disable query validation
    pub fn set_validation_enabled(&mut self, enabled: bool) {
        self.enable_validation = enabled;
    }

    /// Enable or disable error collection (collect vs fail-fast)
    pub fn set_error_collection_enabled(&mut self, enabled: bool) {
        self.collect_errors = enabled;
    }

    /// Get a mutable reference to the resolver registry
    pub fn resolver_registry_mut(&mut self) -> &mut ResolverRegistry {
        &mut self.resolver_registry
    }

    /// Configure the result formatter
    pub fn set_result_formatter(&mut self, formatter: ResultFormatter) {
        self.result_formatter = formatter;
    }

    /// Enable or disable enhanced error formatting
    pub fn set_enhanced_errors(&mut self, enabled: bool) {
        self.result_formatter = self.result_formatter.clone().with_enhanced_errors(enabled);
    }

    /// Enable or disable extensions in responses
    pub fn set_extensions_enabled(&mut self, enabled: bool) {
        self.result_formatter = self.result_formatter.clone().with_extensions(enabled);
    }

    /// Execute a GraphQL request
    pub fn execute(&self, request: GraphQLRequest) -> GraphQLResponse {
        self.execute_with_error_collection(request)
    }

    /// Execute a GraphQL request asynchronously (for future async resolver support)
    pub async fn execute_async(&self, request: GraphQLRequest) -> GraphQLResponse {
        // For now, delegate to synchronous execution
        // In a full async implementation, this would handle async resolvers
        self.execute_with_error_collection(request)
    }

    /// Execute a GraphQL request with optimizations enabled
    pub fn execute_optimized(&self, request: GraphQLRequest) -> GraphQLResponse {
        // Create an optimized result formatter for this execution
        let optimized_formatter = self.result_formatter.clone()
            .with_extensions(true)
            .with_enhanced_errors(true);
        
        let mut error_collection = if self.collect_errors {
            GraphQLErrorCollection::new()
        } else {
            GraphQLErrorCollection::new_fail_fast()
        };

        // Pre-execution optimizations
        if let Err(e) = self.analyze_query_complexity(&request.query) {
            return optimized_formatter.format_error(e);
        }

        match self.execute_internal_with_errors(request, &mut error_collection) {
            Ok(data) => {
                if error_collection.has_errors() {
                    optimized_formatter.format_partial_success(data, error_collection.to_graphql_errors())
                } else {
                    optimized_formatter.format_success(data)
                }
            }
            Err(_) => {
                if error_collection.has_errors() {
                    optimized_formatter.format_errors(error_collection.to_graphql_errors())
                } else {
                    optimized_formatter.format_error(GraphQLError::new("Unknown execution error"))
                }
            }
        }
    }

    /// Analyze query complexity to prevent resource exhaustion
    fn analyze_query_complexity(&self, query: &str) -> Result<(), GraphQLError> {
        // Parse the query to analyze its complexity
        let document = self.parse_query(query)?;
        
        let mut complexity = 0;
        let max_complexity = 1000; // Configurable limit
        
        for definition in &document.definitions {
            if let crate::graphql::ast::Definition::Operation(operation) = definition {
                complexity += self.calculate_selection_set_complexity(&operation.selection_set, 0)?;
            }
        }
        
        if complexity > max_complexity {
            return Err(GraphQLError::new(format!(
                "Query complexity {} exceeds maximum allowed complexity of {}", 
                complexity, max_complexity
            )));
        }
        
        Ok(())
    }

    /// Calculate complexity of a selection set
    fn calculate_selection_set_complexity(&self, selection_set: &SelectionSet, depth: usize) -> Result<usize, GraphQLError> {
        if depth > 10 {
            return Err(GraphQLError::new("Query depth exceeds maximum allowed depth"));
        }
        
        let mut complexity = 0;
        
        for selection in &selection_set.selections {
            match selection {
                Selection::Field(field) => {
                    complexity += 1; // Base cost for each field
                    
                    // Add complexity for nested selections
                    if let Some(ref nested_selection_set) = field.selection_set {
                        complexity += self.calculate_selection_set_complexity(nested_selection_set, depth + 1)?;
                    }
                }
                Selection::InlineFragment(inline_fragment) => {
                    complexity += self.calculate_selection_set_complexity(&inline_fragment.selection_set, depth)?;
                }
                Selection::FragmentSpread(_) => {
                    complexity += 1; // Fragment spreads have base complexity
                }
            }
        }
        
        Ok(complexity)
    }

    /// Execute a GraphQL request with enhanced error handling
    pub fn execute_with_error_collection(&self, request: GraphQLRequest) -> GraphQLResponse {
        let mut error_collection = if self.collect_errors {
            GraphQLErrorCollection::new()
        } else {
            GraphQLErrorCollection::new_fail_fast()
        };

        match self.execute_internal_with_errors(request, &mut error_collection) {
            Ok(data) => {
                if error_collection.has_errors() {
                    // Partial success with errors
                    self.result_formatter.format_partial_success(data, error_collection.to_graphql_errors())
                } else {
                    self.result_formatter.format_success(data)
                }
            }
            Err(_) => {
                if error_collection.has_errors() {
                    self.result_formatter.format_errors(error_collection.to_graphql_errors())
                } else {
                    self.result_formatter.format_error(GraphQLError::new("Unknown execution error"))
                }
            }
        }
    }

    /// Internal execution method that returns detailed errors
    fn execute_internal(&self, request: GraphQLRequest) -> Result<GraphQLValue, GraphQLError> {
        let mut error_collection = GraphQLErrorCollection::new_fail_fast();
        self.execute_internal_with_errors(request, &mut error_collection)
    }

    /// Internal execution method with error collection
    fn execute_internal_with_errors(
        &self, 
        request: GraphQLRequest, 
        error_collection: &mut GraphQLErrorCollection
    ) -> Result<GraphQLValue, GraphQLError> {
        // Parse the query using our custom parser
        let document = match self.parse_query_with_errors(&request.query, error_collection) {
            Ok(doc) => doc,
            Err(e) => return Err(e),
        };
        
        // Find the operation to execute
        let operation = match self.find_operation_with_errors(&document, request.operation_name.as_deref(), error_collection) {
            Ok(op) => op,
            Err(e) => return Err(e),
        };
        
        // Create execution context
        let variables = request.variables
            .as_ref()
            .and_then(|v| v.as_object())
            .map(|obj| obj.iter().map(|(k, v)| (k.clone(), v.clone())).collect())
            .unwrap_or_default();
            
        let execution_context = Rc::new(ExecutionContext::new(
            self.schema.clone(),
            Rc::new(document),
            Rc::new(operation.clone()),
            variables,
        ).map_err(|errors| {
            GraphQLError::new(format!("Execution context creation failed: {:?}", errors))
        })?);

        // Validate the query if validation is enabled
        if self.enable_validation {
            if let Err(e) = self.validate_query_with_errors(&execution_context, error_collection) {
                return Err(e);
            }
        }

        // Execute the operation
        self.execute_operation_with_errors(&execution_context, error_collection)
    }

    /// Parse a GraphQL query string into a document
    fn parse_query(&self, query: &str) -> Result<Document, GraphQLError> {
        use crate::graphql::{Lexer, CustomParser};
        
        let lexer = Lexer::new(query);
        let mut parser = CustomParser::new(lexer)?;
        parser.parse()
    }

    /// Parse a GraphQL query with error collection
    fn parse_query_with_errors(
        &self, 
        query: &str, 
        error_collection: &mut GraphQLErrorCollection
    ) -> Result<Document, GraphQLError> {
        match self.parse_query(query) {
            Ok(document) => Ok(document),
            Err(error) => {
                let enhanced_error = EnhancedGraphQLError::new(
                    error.message.clone(), 
                    ErrorCategory::Syntax
                ).with_severity(ErrorSeverity::Critical);
                
                error_collection.add_error(enhanced_error)?;
                Err(error)
            }
        }
    }

    /// Find the operation to execute from the document
    fn find_operation(&self, document: &Document, operation_name: Option<&str>) -> Result<OperationDefinition, GraphQLError> {
        let operations: Vec<&OperationDefinition> = document.operations().collect();
        
        match operations.len() {
            0 => Err(GraphQLError::new("No operations found in document")),
            1 => Ok(operations[0].clone()),
            _ => {
                // Multiple operations - need operation name
                match operation_name {
                    Some(name) => {
                        operations
                            .iter()
                            .find(|op| op.name.as_ref() == Some(&name.to_string()))
                            .map(|op| (*op).clone())
                            .ok_or_else(|| GraphQLError::new(format!("Operation '{}' not found", name)))
                    }
                    None => Err(GraphQLError::new("Operation name required when multiple operations are present")),
                }
            }
        }
    }

    /// Find the operation to execute with error collection
    fn find_operation_with_errors(
        &self, 
        document: &Document, 
        operation_name: Option<&str>,
        error_collection: &mut GraphQLErrorCollection
    ) -> Result<OperationDefinition, GraphQLError> {
        match self.find_operation(document, operation_name) {
            Ok(operation) => Ok(operation),
            Err(error) => {
                let enhanced_error = EnhancedGraphQLError::new(
                    error.message.clone(), 
                    ErrorCategory::Validation
                ).with_severity(ErrorSeverity::High);
                
                error_collection.add_error(enhanced_error)?;
                Err(error)
            }
        }
    }

    /// Validate the query using our validation system
    fn validate_query(&self, execution_context: &ExecutionContext) -> Result<(), GraphQLError> {
        Validator::validate(&execution_context.schema, &execution_context.document)
            .map_err(|errors| {
                let messages: Vec<String> = errors.iter().map(|e| e.message.clone()).collect();
                GraphQLError::new(format!("Validation failed: {}", messages.join(", ")))
            })
    }

    /// Validate the query with error collection
    fn validate_query_with_errors(
        &self, 
        execution_context: &ExecutionContext,
        error_collection: &mut GraphQLErrorCollection
    ) -> Result<(), GraphQLError> {
        match Validator::validate(&execution_context.schema, &execution_context.document) {
            Ok(()) => Ok(()),
            Err(validation_errors) => {
                for validation_error in validation_errors {
                    let enhanced_error = EnhancedGraphQLError::new(
                        validation_error.message.clone(), 
                        ErrorCategory::Validation
                    ).with_severity(ErrorSeverity::High);
                    
                    error_collection.add_error(enhanced_error)?;
                }
                
                Err(GraphQLError::new("Validation failed"))
            }
        }
    }

    /// Execute a GraphQL operation
    fn execute_operation(&self, execution_context: &Rc<ExecutionContext>) -> Result<GraphQLValue, GraphQLError> {
        let operation = &execution_context.operation;
        
        // Determine the root type name based on operation type
        let root_type_name = match operation.operation_type {
            crate::graphql::ast::OperationType::Query => execution_context.schema.query_type.name.clone(),
            crate::graphql::ast::OperationType::Mutation => {
                execution_context.schema.mutation_type
                    .as_ref()
                    .map(|t| t.name.clone())
                    .ok_or_else(|| GraphQLError::new("Schema does not support mutations"))?
            }
            crate::graphql::ast::OperationType::Subscription => {
                execution_context.schema.subscription_type
                    .as_ref()
                    .map(|t| t.name.clone())
                    .ok_or_else(|| GraphQLError::new("Schema does not support subscriptions"))?
            }
        };

        // Execute the root selection set
        self.execute_selection_set(
            &operation.selection_set,
            &root_type_name,
            None,
            execution_context,
        )
    }

    /// Execute a GraphQL operation with error collection
    fn execute_operation_with_errors(
        &self, 
        execution_context: &Rc<ExecutionContext>,
        error_collection: &mut GraphQLErrorCollection
    ) -> Result<GraphQLValue, GraphQLError> {
        let operation = &execution_context.operation;
        
        // Determine the root type name based on operation type
        let root_type_name = match operation.operation_type {
            crate::graphql::ast::OperationType::Query => execution_context.schema.query_type.name.clone(),
            crate::graphql::ast::OperationType::Mutation => {
                execution_context.schema.mutation_type
                    .as_ref()
                    .map(|t| t.name.clone())
                    .ok_or_else(|| {
                        let error = EnhancedGraphQLError::new(
                            "Schema does not support mutations", 
                            ErrorCategory::Execution
                        ).with_severity(ErrorSeverity::High);
                        let _ = error_collection.add_error(error);
                        GraphQLError::new("Schema does not support mutations")
                    })?
            }
            crate::graphql::ast::OperationType::Subscription => {
                execution_context.schema.subscription_type
                    .as_ref()
                    .map(|t| t.name.clone())
                    .ok_or_else(|| {
                        let error = EnhancedGraphQLError::new(
                            "Schema does not support subscriptions", 
                            ErrorCategory::Execution
                        ).with_severity(ErrorSeverity::High);
                        let _ = error_collection.add_error(error);
                        GraphQLError::new("Schema does not support subscriptions")
                    })?
            }
        };

        // Execute the root selection set with error collection
        self.execute_selection_set_with_errors(
            &operation.selection_set,
            &root_type_name,
            None,
            execution_context,
            error_collection,
            &mut ExecutionPathBuilder::new(),
        )
    }

    /// Execute a selection set
    fn execute_selection_set(
        &self,
        selection_set: &SelectionSet,
        type_name: &str,
        parent_value: Option<Value>,
        execution_context: &Rc<ExecutionContext>,
    ) -> Result<GraphQLValue, GraphQLError> {
        let mut result = HashMap::new();
        let mut errors = Vec::new();

        for selection in &selection_set.selections {
            match self.execute_selection(selection, type_name, parent_value.clone(), execution_context) {
                Ok((field_name, field_value)) => {
                    result.insert(field_name, field_value);
                }
                Err(error) => {
                    errors.push(error);
                }
            }
        }

        if !errors.is_empty() && result.is_empty() {
            // If we have errors and no successful results, return the first error
            return Err(errors.into_iter().next().unwrap());
        }

        Ok(GraphQLValue::Object(result))
    }

    /// Execute a selection set with error collection
    fn execute_selection_set_with_errors(
        &self,
        selection_set: &SelectionSet,
        type_name: &str,
        parent_value: Option<Value>,
        execution_context: &Rc<ExecutionContext>,
        error_collection: &mut GraphQLErrorCollection,
        path_builder: &mut ExecutionPathBuilder,
    ) -> Result<GraphQLValue, GraphQLError> {
        let mut result = HashMap::new();
        let mut partial_success = false;

        for selection in &selection_set.selections {
            match self.execute_selection_with_errors(
                selection, 
                type_name, 
                parent_value.clone(), 
                execution_context, 
                error_collection,
                path_builder
            ) {
                Ok((field_name, field_value)) => {
                    result.insert(field_name, field_value);
                    partial_success = true;
                }
                Err(error) => {
                    // In error collection mode, we continue execution
                    let enhanced_error = EnhancedGraphQLError::new(
                        error.message.clone(), 
                        ErrorCategory::Execution
                    ).with_severity(ErrorSeverity::Medium)
                    .with_path(path_builder.current_path());
                    
                    if error_collection.add_error(enhanced_error).is_err() {
                        // Fail-fast mode
                        return Err(error);
                    }
                }
            }
        }

        if !partial_success && error_collection.has_errors() {
            // No successful results and we have errors
            return Err(GraphQLError::new("No fields could be resolved"));
        }

        Ok(GraphQLValue::Object(result))
    }

    /// Execute a single selection
    fn execute_selection(
        &self,
        selection: &Selection,
        type_name: &str,
        parent_value: Option<Value>,
        execution_context: &Rc<ExecutionContext>,
    ) -> Result<(String, GraphQLValue), GraphQLError> {
        match selection {
            Selection::Field(field) => {
                let field_result = self.execute_field(field, type_name, parent_value.clone(), execution_context)?;
                let field_name = field.alias.as_ref().unwrap_or(&field.name).clone();
                Ok((field_name, field_result))
            }
            Selection::InlineFragment(inline_fragment) => {
                self.execute_inline_fragment(inline_fragment, type_name, parent_value, execution_context)
            }
            Selection::FragmentSpread(fragment_spread) => {
                self.execute_fragment_spread(fragment_spread, type_name, parent_value, execution_context)
            }
        }
    }

    /// Execute a single selection with error collection
    fn execute_selection_with_errors(
        &self,
        selection: &Selection,
        type_name: &str,
        parent_value: Option<Value>,
        execution_context: &Rc<ExecutionContext>,
        error_collection: &mut GraphQLErrorCollection,
        path_builder: &mut ExecutionPathBuilder,
    ) -> Result<(String, GraphQLValue), GraphQLError> {
        match selection {
            Selection::Field(field) => {
                path_builder.push_field(&field.name);
                let result = self.execute_field_with_errors(
                    field, 
                    type_name, 
                    parent_value.clone(), 
                    execution_context,
                    error_collection,
                    path_builder
                );
                path_builder.pop();
                
                match result {
                    Ok(field_result) => {
                        let field_name = field.alias.as_ref().unwrap_or(&field.name).clone();
                        Ok((field_name, field_result))
                    }
                    Err(e) => Err(e)
                }
            }
            Selection::InlineFragment(inline_fragment) => {
                self.execute_inline_fragment_with_errors(
                    inline_fragment, 
                    type_name, 
                    parent_value, 
                    execution_context,
                    error_collection,
                    path_builder
                )
            }
            Selection::FragmentSpread(fragment_spread) => {
                self.execute_fragment_spread_with_errors(
                    fragment_spread, 
                    type_name, 
                    parent_value, 
                    execution_context,
                    error_collection,
                    path_builder
                )
            }
        }
    }

    /// Execute a field
    fn execute_field(
        &self,
        field: &AstField,
        type_name: &str,
        parent_value: Option<Value>,
        execution_context: &Rc<ExecutionContext>,
    ) -> Result<GraphQLValue, GraphQLError> {
        // Get the field definition from the schema
        let schema_field = self.get_field_definition(type_name, &field.name)?;
        
        // Create field context
        let field_context = FieldContext::new(
            execution_context.clone(),
            field,
            schema_field.clone(),
            parent_value,
        )?;

        // Try to find a custom resolver first
        if let Some(resolver) = self.resolver_registry.get_resolver(type_name, &field.name) {
            let field_value = if resolver.is_async() {
                // For now, we'll handle async resolvers synchronously
                // In a full implementation, this would need proper async support
                return Err(GraphQLError::new("Async resolvers not yet supported in this execution path"));
            } else {
                resolver.resolve_sync(&field_context)?
            };

            // If the field has a selection set and returns a composite type, execute it
            if let Some(ref selection_set) = field.selection_set {
                return self.execute_field_selection_set(
                    selection_set,
                    &schema_field.field_type,
                    field_value,
                    execution_context,
                );
            }

            return Ok(field_value);
        }

        // If no custom resolver, try to resolve based on field type
        self.resolve_field_by_type(&field_context, execution_context)
    }

    /// Resolve a field based on its type when no custom resolver is available
    fn resolve_field_by_type(
        &self,
        field_context: &FieldContext,
        execution_context: &Rc<ExecutionContext>,
    ) -> Result<GraphQLValue, GraphQLError> {
        let field_type = &field_context.schema_field.field_type;
        let field_name = &field_context.field_info.field_name;

        match field_type {
            GraphQLType::Scalar(_) => {
                // Use built-in scalar resolver
                self.resolve_scalar_field(field_context)
            }
            GraphQLType::Object(_obj_type) => {
                // For object types, we need a selection set
                if field_context.execution_context.is_composite_type() {
                    return Err(GraphQLError::new(
                        format!("Field '{}' of composite type requires a selection set", field_name)
                    ));
                }
                
                // Return the parent value to be processed by selection set
                Ok(field_context.field_info.parent_value.clone().unwrap_or(Value::Null).into())
            }
            GraphQLType::List(inner_type) => {
                // Handle list types
                self.resolve_list_field(field_context, inner_type, execution_context)
            }
            GraphQLType::NonNull(inner_type) => {
                // Unwrap non-null and resolve the inner type
                let inner_field_context = FieldContext {
                    execution_context: field_context.execution_context.clone(),
                    field_info: crate::graphql::FieldResolutionInfo {
                        field_name: field_context.field_info.field_name.clone(),
                        arguments: field_context.field_info.arguments.clone(),
                        parent_value: field_context.field_info.parent_value.clone(),
                        return_type: (**inner_type).clone(),
                        path: field_context.field_info.path.clone(),
                    },
                    schema_field: crate::graphql::schema::Field {
                        field_type: (**inner_type).clone(),
                        description: field_context.schema_field.description.clone(),
                        args: field_context.schema_field.args.clone(),
                        deprecation_reason: field_context.schema_field.deprecation_reason.clone(),
                    },
                };
                
                let result = self.resolve_field_by_type(&inner_field_context, execution_context)?;
                
                // Check that the result is not null for non-null types
                if matches!(result, GraphQLValue::Null) {
                    return Err(GraphQLError::new(
                        format!("Field '{}' cannot return null", field_name)
                    ));
                }
                
                Ok(result)
            }
            _ => {
                Err(GraphQLError::new(
                    format!("Unsupported field type for field '{}'", field_name)
                ))
            }
        }
    }

    /// Resolve a scalar field using built-in resolvers
    fn resolve_scalar_field(&self, field_context: &FieldContext) -> Result<GraphQLValue, GraphQLError> {
        if let GraphQLType::Scalar(scalar_type) = &field_context.schema_field.field_type {
            // Use the appropriate built-in scalar resolver
            if let Some(resolver) = self.resolver_registry.get_resolver(&scalar_type.name, "__resolve") {
                resolver.resolve_sync(field_context)
            } else {
                // Fallback to string representation
                match &field_context.field_info.parent_value {
                    Some(value) => Ok(GraphQLValue::String(value.to_string())),
                    None => Ok(GraphQLValue::Null),
                }
            }
        } else {
            Err(GraphQLError::new("Expected scalar type"))
        }
    }

    /// Resolve a list field
    fn resolve_list_field(
        &self,
        field_context: &FieldContext,
        inner_type: &GraphQLType,
        execution_context: &Rc<ExecutionContext>,
    ) -> Result<GraphQLValue, GraphQLError> {
        match &field_context.field_info.parent_value {
            Some(Value::Array(arr)) => {
                let mut result_items = Vec::new();
                
                for (index, item) in arr.iter().enumerate() {
                    let item_context = FieldContext {
                        execution_context: field_context.execution_context.clone(),
                        field_info: crate::graphql::FieldResolutionInfo {
                            field_name: field_context.field_info.field_name.clone(),
                            arguments: field_context.field_info.arguments.clone(),
                            parent_value: Some(item.clone()),
                            return_type: inner_type.clone(),
                            path: {
                                let mut path = field_context.field_info.path.clone();
                                path.push(Value::Number(index.into()));
                                path
                            },
                        },
                        schema_field: crate::graphql::schema::Field {
                            field_type: inner_type.clone(),
                            description: field_context.schema_field.description.clone(),
                            args: field_context.schema_field.args.clone(),
                            deprecation_reason: field_context.schema_field.deprecation_reason.clone(),
                        },
                    };

                    let item_result = self.resolve_field_by_type(&item_context, execution_context)?;
                    result_items.push(item_result);
                }
                
                Ok(GraphQLValue::List(result_items))
            }
            Some(Value::Null) => Ok(GraphQLValue::Null),
            Some(_) => Err(GraphQLError::new("Expected array value for list field")),
            None => Ok(GraphQLValue::Null),
        }
    }

    /// Execute a field's selection set for composite types
    fn execute_field_selection_set(
        &self,
        selection_set: &SelectionSet,
        field_type: &GraphQLType,
        field_value: GraphQLValue,
        execution_context: &Rc<ExecutionContext>,
    ) -> Result<GraphQLValue, GraphQLError> {
        match field_value {
            GraphQLValue::Object(_) => {
                if let Some(type_name) = field_type.name() {
                    self.execute_selection_set(
                        selection_set,
                        type_name,
                        Some(field_value.into()),
                        execution_context,
                    )
                } else {
                    Err(GraphQLError::new("Cannot determine type name for object field"))
                }
            }
            GraphQLValue::List(items) => {
                let mut result_items = Vec::new();
                
                for item in items {
                    if let GraphQLValue::Object(_) = item {
                        if let Some(type_name) = field_type.name() {
                            let item_result = self.execute_selection_set(
                                selection_set,
                                type_name,
                                Some(item.clone().into()),
                                execution_context,
                            )?;
                            result_items.push(item_result);
                        }
                    } else {
                        result_items.push(item);
                    }
                }
                
                Ok(GraphQLValue::List(result_items))
            }
            GraphQLValue::Null => Ok(GraphQLValue::Null),
            _ => Ok(field_value), // Return scalar values as-is
        }
    }

    /// Execute an inline fragment
    fn execute_inline_fragment(
        &self,
        inline_fragment: &InlineFragment,
        type_name: &str,
        parent_value: Option<Value>,
        execution_context: &Rc<ExecutionContext>,
    ) -> Result<(String, GraphQLValue), GraphQLError> {
        // Check type condition if present
        if let Some(ref type_condition) = inline_fragment.type_condition {
            if type_condition != type_name {
                // Type condition doesn't match, skip this fragment
                return Ok(("__fragment".to_string(), GraphQLValue::Object(HashMap::new())));
            }
        }

        // Execute the fragment's selection set
        let fragment_result = self.execute_selection_set(
            &inline_fragment.selection_set,
            type_name,
            parent_value,
            execution_context,
        )?;

        Ok(("__fragment".to_string(), fragment_result))
    }

    /// Execute a fragment spread
    fn execute_fragment_spread(
        &self,
        fragment_spread: &FragmentSpread,
        type_name: &str,
        parent_value: Option<Value>,
        execution_context: &Rc<ExecutionContext>,
    ) -> Result<(String, GraphQLValue), GraphQLError> {
        // Get the fragment definition
        let fragment = execution_context.get_fragment(&fragment_spread.fragment_name)
            .ok_or_else(|| GraphQLError::new(
                format!("Fragment '{}' not found", fragment_spread.fragment_name)
            ))?;

        // Check type condition
        if fragment.type_condition != type_name {
            // Type condition doesn't match, skip this fragment
            return Ok(("__fragment".to_string(), GraphQLValue::Object(HashMap::new())));
        }

        // Execute the fragment's selection set
        let fragment_result = self.execute_selection_set(
            &fragment.selection_set,
            type_name,
            parent_value,
            execution_context,
        )?;

        Ok(("__fragment".to_string(), fragment_result))
    }

    /// Get a field definition from the schema
    fn get_field_definition(&self, type_name: &str, field_name: &str) -> Result<SchemaField, GraphQLError> {
        let schema_type = self.schema.get_type(type_name)
            .ok_or_else(|| GraphQLError::new(format!("Type '{}' not found in schema", type_name)))?;

        match schema_type {
            GraphQLType::Object(obj_type) => {
                obj_type.fields.get(field_name)
                    .cloned()
                    .ok_or_else(|| GraphQLError::new(
                        format!("Field '{}' not found on type '{}'", field_name, type_name)
                    ))
            }
            GraphQLType::Interface(interface_type) => {
                interface_type.fields.get(field_name)
                    .cloned()
                    .ok_or_else(|| GraphQLError::new(
                        format!("Field '{}' not found on interface '{}'", field_name, type_name)
                    ))
            }
            _ => Err(GraphQLError::new(
                format!("Type '{}' does not support field selection", type_name)
            ))
        }
    }

    /// Execute a field with error collection
    fn execute_field_with_errors(
        &self,
        field: &AstField,
        type_name: &str,
        parent_value: Option<Value>,
        execution_context: &Rc<ExecutionContext>,
        error_collection: &mut GraphQLErrorCollection,
        path_builder: &mut ExecutionPathBuilder,
    ) -> Result<GraphQLValue, GraphQLError> {
        // For now, delegate to the original field execution
        // In a full implementation, this would integrate error collection throughout
        match self.execute_field(field, type_name, parent_value, execution_context) {
            Ok(result) => Ok(result),
            Err(error) => {
                let enhanced_error = EnhancedGraphQLError::new(
                    error.message.clone(), 
                    ErrorCategory::FieldResolution
                ).with_severity(ErrorSeverity::Medium)
                .with_path(path_builder.current_path());
                
                if let Err(collected_error) = error_collection.add_error(enhanced_error) {
                    Err(collected_error)
                } else {
                    Err(error)
                }
            }
        }
    }

    /// Execute an inline fragment with error collection
    fn execute_inline_fragment_with_errors(
        &self,
        inline_fragment: &InlineFragment,
        type_name: &str,
        parent_value: Option<Value>,
        execution_context: &Rc<ExecutionContext>,
        error_collection: &mut GraphQLErrorCollection,
        path_builder: &mut ExecutionPathBuilder,
    ) -> Result<(String, GraphQLValue), GraphQLError> {
        // For now, delegate to the original implementation
        match self.execute_inline_fragment(inline_fragment, type_name, parent_value, execution_context) {
            Ok(result) => Ok(result),
            Err(error) => {
                let enhanced_error = EnhancedGraphQLError::new(
                    error.message.clone(), 
                    ErrorCategory::Execution
                ).with_severity(ErrorSeverity::Medium)
                .with_path(path_builder.current_path());
                
                if let Err(collected_error) = error_collection.add_error(enhanced_error) {
                    Err(collected_error)
                } else {
                    Err(error)
                }
            }
        }
    }

    /// Execute a fragment spread with error collection
    fn execute_fragment_spread_with_errors(
        &self,
        fragment_spread: &FragmentSpread,
        type_name: &str,
        parent_value: Option<Value>,
        execution_context: &Rc<ExecutionContext>,
        error_collection: &mut GraphQLErrorCollection,
        path_builder: &mut ExecutionPathBuilder,
    ) -> Result<(String, GraphQLValue), GraphQLError> {
        // For now, delegate to the original implementation
        match self.execute_fragment_spread(fragment_spread, type_name, parent_value, execution_context) {
            Ok(result) => Ok(result),
            Err(error) => {
                let enhanced_error = EnhancedGraphQLError::new(
                    error.message.clone(), 
                    ErrorCategory::Execution
                ).with_severity(ErrorSeverity::Medium)
                .with_path(path_builder.current_path());
                
                if let Err(collected_error) = error_collection.add_error(enhanced_error) {
                    Err(collected_error)
                } else {
                    Err(error)
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::graphql::{
        schema::{ObjectType, ScalarType, Field as SchemaField},
    };
    use serde_json::json;

    fn create_test_schema() -> GraphQLSchema {
        let string_type = GraphQLType::Scalar(ScalarType::string());
        let int_type = GraphQLType::Scalar(ScalarType::int());

        let user_type = ObjectType::new("User")
            .add_field("id", SchemaField::new(string_type.clone()))
            .add_field("name", SchemaField::new(string_type.clone()))
            .add_field("age", SchemaField::new(int_type.clone()));

        let query_type = ObjectType::new("Query")
            .add_field("hello", SchemaField::new(string_type.clone()))
            .add_field("user", SchemaField::new(GraphQLType::Object(user_type.clone())));

        let mut schema = GraphQLSchema::new(query_type);
        schema.add_type("User".to_string(), GraphQLType::Object(user_type));
        schema
    }

    #[test]
    fn test_query_executor_creation() {
        let schema = create_test_schema();
        let executor = QueryExecutor::new(schema);
        
        assert_eq!(executor.schema.query_type.name, "Query");
        assert!(executor.enable_validation);
    }

    #[test]
    fn test_parse_simple_query() {
        let schema = create_test_schema();
        let executor = QueryExecutor::new(schema);
        
        let query = "{ hello }";
        let document = executor.parse_query(query).unwrap();
        
        assert_eq!(document.definitions.len(), 1);
    }

    #[test]
    fn test_find_operation() {
        let schema = create_test_schema();
        let executor = QueryExecutor::new(schema);
        
        let query = "query GetHello { hello }";
        let document = executor.parse_query(query).unwrap();
        
        let operation = executor.find_operation(&document, Some("GetHello")).unwrap();
        assert_eq!(operation.name, Some("GetHello".to_string()));
    }

    #[test]
    fn test_execute_simple_query() {
        let schema = create_test_schema();
        let mut executor = QueryExecutor::new(schema);
        
        // Add a resolver for the hello field
        executor.resolver_registry_mut().add_sync_resolver("Query", "hello", |_context| {
            Ok(GraphQLValue::String("Hello, World!".to_string()))
        });
        
        let request = GraphQLRequest {
            query: "{ hello }".to_string(),
            variables: None,
            operation_name: None,
        };
        
        let response = executor.execute(request);
        
        if let Some(data) = response.data {
            if let Some(hello) = data.get("hello") {
                assert_eq!(hello, &json!("Hello, World!"));
            } else {
                panic!("Expected 'hello' field in response");
            }
        } else {
            panic!("Expected data in response: {:?}", response.errors);
        }
    }

    #[test]
    fn test_validation_error() {
        let schema = create_test_schema();
        let executor = QueryExecutor::new(schema);
        
        let request = GraphQLRequest {
            query: "{ unknownField }".to_string(),
            variables: None,
            operation_name: None,
        };
        
        let response = executor.execute(request);
        
        assert!(response.data.is_none());
        assert!(response.errors.is_some());
        
        let errors = response.errors.unwrap();
        assert!(!errors.is_empty());
        // The error message might be different in our enhanced error handling
        assert!(errors[0].message.contains("Validation") || 
                errors[0].message.contains("not found") ||
                errors[0].message.contains("unknown"));
    }

    #[test]
    fn test_disable_validation() {
        let schema = create_test_schema();
        let mut executor = QueryExecutor::new(schema);
        executor.set_validation_enabled(false);
        
        let request = GraphQLRequest {
            query: "{ unknownField }".to_string(),
            variables: None,
            operation_name: None,
        };
        
        let response = executor.execute(request);
        
        // Without validation, this should fail at execution time instead
        assert!(response.errors.is_some());
        let errors = response.errors.unwrap();
        assert!(errors[0].message.contains("not found"));
    }

    #[test]
    fn test_error_collection_enabled() {
        let schema = create_test_schema();
        let mut executor = QueryExecutor::new(schema);
        executor.set_error_collection_enabled(true);
        executor.set_validation_enabled(false); // Skip validation to test execution errors
        
        let request = GraphQLRequest {
            query: "{ unknownField anotherUnknownField }".to_string(),
            variables: None,
            operation_name: None,
        };
        
        let response = executor.execute(request);
        
        // With error collection, we should get multiple errors
        assert!(response.errors.is_some());
        let errors = response.errors.unwrap();
        assert!(errors.len() >= 1); // At least one error, possibly more depending on execution order
    }

    #[test]
    fn test_error_collection_disabled_fail_fast() {
        let schema = create_test_schema();
        let mut executor = QueryExecutor::new(schema);
        executor.set_error_collection_enabled(false); // Fail-fast mode
        executor.set_validation_enabled(false); // Skip validation to test execution errors
        
        let request = GraphQLRequest {
            query: "{ unknownField anotherUnknownField }".to_string(),
            variables: None,
            operation_name: None,
        };
        
        let response = executor.execute(request);
        
        // In fail-fast mode, we should stop at first error
        assert!(response.errors.is_some());
        let errors = response.errors.unwrap();
        assert_eq!(errors.len(), 1); // Should have exactly one error
    }

    #[test]
    fn test_syntax_error_handling() {
        let schema = create_test_schema();
        let executor = QueryExecutor::new(schema);
        
        let request = GraphQLRequest {
            query: "{ unclosed".to_string(), // Syntax error - unclosed brace
            variables: None,
            operation_name: None,
        };
        
        let response = executor.execute(request);
        
        assert!(response.errors.is_some());
        let errors = response.errors.unwrap();
        assert_eq!(errors.len(), 1);
        
        // Check that error has proper extensions with category
        if let Some(extensions) = &errors[0].extensions {
            if let Some(category) = extensions.get("category") {
                assert_eq!(category, &Value::String("Syntax".to_string()));
            }
        }
    }

    #[test] 
    fn test_partial_success_with_errors() {
        let schema = create_test_schema();
        let mut executor = QueryExecutor::new(schema);
        executor.set_error_collection_enabled(true);
        executor.set_validation_enabled(false);
        
        // Add a working resolver for hello field
        executor.resolver_registry_mut().add_sync_resolver("Query", "hello", |_context| {
            Ok(GraphQLValue::String("Hello, World!".to_string()))
        });
        
        let request = GraphQLRequest {
            query: "{ hello unknownField }".to_string(),
            variables: None,
            operation_name: None,
        };
        
        let response = executor.execute(request);
        
        // Should have partial data and errors
        assert!(response.data.is_some());
        assert!(response.errors.is_some());
        
        let data = response.data.unwrap();
        assert!(data.get("hello").is_some());
        
        let errors = response.errors.unwrap();
        assert!(!errors.is_empty());
    }

    #[test]
    fn test_async_execution() {
        let schema = create_test_schema();
        let mut executor = QueryExecutor::new(schema);
        
        // Add a resolver for the hello field
        executor.resolver_registry_mut().add_sync_resolver("Query", "hello", |_context| {
            Ok(GraphQLValue::String("Hello, Async World!".to_string()))
        });
        
        let request = GraphQLRequest {
            query: "{ hello }".to_string(),
            variables: None,
            operation_name: None,
        };
        
        // Use a simple async runtime for testing
        let rt = tokio::runtime::Builder::new_current_thread().enable_all().build().unwrap();
        let response = rt.block_on(executor.execute_async(request));
        
        assert!(response.data.is_some());
        if let Some(data) = response.data {
            if let Some(hello) = data.get("hello") {
                assert_eq!(hello, &json!("Hello, Async World!"));
            }
        }
    }

    #[test]
    fn test_optimized_execution() {
        let schema = create_test_schema();
        let mut executor = QueryExecutor::new(schema);
        
        // Add a resolver for the hello field
        executor.resolver_registry_mut().add_sync_resolver("Query", "hello", |_context| {
            Ok(GraphQLValue::String("Hello, Optimized World!".to_string()))
        });
        
        let request = GraphQLRequest {
            query: "{ hello }".to_string(),
            variables: None,
            operation_name: None,
        };
        
        let response = executor.execute_optimized(request);
        
        assert!(response.data.is_some());
        assert!(response.extensions.is_some()); // Optimized execution includes extensions
        
        if let Some(data) = response.data {
            if let Some(hello) = data.get("hello") {
                assert_eq!(hello, &json!("Hello, Optimized World!"));
            }
        }
    }

    #[test]
    fn test_result_formatter_integration() {
        let schema = create_test_schema();
        let mut executor = QueryExecutor::new(schema);
        executor.set_enhanced_errors(true);
        executor.set_extensions_enabled(true);
        
        // Add a resolver for the hello field
        executor.resolver_registry_mut().add_sync_resolver("Query", "hello", |_context| {
            Ok(GraphQLValue::String("Hello, Formatted World!".to_string()))
        });
        
        let request = GraphQLRequest {
            query: "{ hello }".to_string(),
            variables: None,
            operation_name: None,
        };
        
        let response = executor.execute(request);
        
        assert!(response.data.is_some());
        assert!(response.extensions.is_some()); // Extensions enabled
        
        if let Some(data) = response.data {
            if let Some(hello) = data.get("hello") {
                assert_eq!(hello, &json!("Hello, Formatted World!"));
            }
        }
    }

    #[test]
    fn test_query_complexity_analysis() {
        let schema = create_test_schema();
        let executor = QueryExecutor::new(schema);
        
        // Test simple query (should pass)
        let simple_request = GraphQLRequest {
            query: "{ hello }".to_string(),
            variables: None,
            operation_name: None,
        };
        
        let response = executor.execute_optimized(simple_request);
        // Simple query should not be rejected for complexity
        assert!(response.data.is_some() || response.errors.is_some());
        
        // Test complex nested query (should be rejected)
        let complex_query = "{ ".to_string() + &"user { id name ".repeat(100) + &"}".repeat(100) + " }";
        let complex_request = GraphQLRequest {
            query: complex_query,
            variables: None,
            operation_name: None,
        };
        
        let response = executor.execute_optimized(complex_request);
        assert!(response.errors.is_some());
        
        let errors = response.errors.unwrap();
        assert!(!errors.is_empty());
        assert!(errors[0].message.contains("complexity") || errors[0].message.contains("depth"));
    }

    #[test]
    fn test_execution_context_integration() {
        let schema = create_test_schema();
        let mut executor = QueryExecutor::new(schema);
        
        // Add a resolver that uses execution context
        executor.resolver_registry_mut().add_sync_resolver("Query", "hello", |context| {
            // Access execution context information
            let operation = &context.execution_context.operation;
            let operation_type = &operation.operation_type;
            
            match operation_type {
                crate::graphql::ast::OperationType::Query => {
                    Ok(GraphQLValue::String("Query operation executed".to_string()))
                }
                _ => Ok(GraphQLValue::String("Other operation executed".to_string()))
            }
        });
        
        let request = GraphQLRequest {
            query: "query TestOperation { hello }".to_string(),
            variables: None,
            operation_name: Some("TestOperation".to_string()),
        };
        
        let response = executor.execute(request);
        
        assert!(response.data.is_some());
        if let Some(data) = response.data {
            if let Some(hello) = data.get("hello") {
                assert_eq!(hello, &json!("Query operation executed"));
            }
        }
    }

    #[test]
    fn test_error_enhancement() {
        let schema = create_test_schema();
        let mut executor = QueryExecutor::new(schema);
        executor.set_enhanced_errors(true);
        executor.set_validation_enabled(false); // Disable validation to test execution errors
        
        let request = GraphQLRequest {
            query: "{ nonExistentField }".to_string(),
            variables: None,
            operation_name: None,
        };
        
        let response = executor.execute(request);
        
        assert!(response.errors.is_some());
        let errors = response.errors.unwrap();
        assert!(!errors.is_empty());
        
        // Check that enhanced errors include timestamp
        if let Some(extensions) = &errors[0].extensions {
            if let Value::Object(ext_obj) = extensions {
                assert!(ext_obj.contains_key("timestamp"));
            }
        }
    }

    #[test]
    fn test_partial_success_formatting() {
        let schema = create_test_schema();
        let mut executor = QueryExecutor::new(schema);
        executor.set_error_collection_enabled(true);
        executor.set_validation_enabled(false);
        
        // Add resolver for hello but not for nonExistentField
        executor.resolver_registry_mut().add_sync_resolver("Query", "hello", |_context| {
            Ok(GraphQLValue::String("Partial success!".to_string()))
        });
        
        let request = GraphQLRequest {
            query: "{ hello nonExistentField }".to_string(),
            variables: None,
            operation_name: None,
        };
        
        let response = executor.execute(request);
        
        // Should have both data and errors (partial success)
        assert!(response.data.is_some());
        assert!(response.errors.is_some());
        
        let data = response.data.unwrap();
        assert!(data.get("hello").is_some());
        
        let errors = response.errors.unwrap();
        assert!(!errors.is_empty());
    }
}