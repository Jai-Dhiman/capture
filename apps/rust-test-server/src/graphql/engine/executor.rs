use crate::graphql::{
    GraphQLError, GraphQLParser, GraphQLRequest, GraphQLResponse, GraphQLSchema, GraphQLValue,
    Document, Definition, OperationDefinition, Selection, AstField, Value as AstValue, SelectionSet
};
use crate::graphql::parser::OperationType;
use serde_json::{json, Value};
use std::collections::HashMap;

fn capitalize_first_letter(s: &str) -> String {
    let mut chars = s.chars();
    match chars.next() {
        None => String::new(),
        Some(first) => first.to_uppercase().chain(chars).collect(),
    }
}

pub type ResolverFunction = Box<dyn Fn(&ResolverContext) -> Result<GraphQLValue, GraphQLError> + Send + Sync>;

pub struct GraphQLExecutor {
    schema: GraphQLSchema,
    resolvers: HashMap<String, HashMap<String, ResolverFunction>>,
}

pub struct ResolverContext {
    pub field_name: String,
    pub arguments: HashMap<String, Value>,
    pub parent: Option<Value>,
    pub variables: HashMap<String, Value>,
}

impl GraphQLExecutor {
    pub fn new(schema: GraphQLSchema) -> Self {
        Self {
            schema,
            resolvers: HashMap::new(),
        }
    }

    pub fn add_resolver<F>(
        &mut self,
        type_name: impl Into<String>,
        field_name: impl Into<String>,
        resolver: F,
    ) where
        F: Fn(&ResolverContext) -> Result<GraphQLValue, GraphQLError> + Send + Sync + 'static,
    {
        let type_name = type_name.into();
        let field_name = field_name.into();
        
        self.resolvers
            .entry(type_name)
            .or_insert_with(HashMap::new)
            .insert(field_name, Box::new(resolver));
    }

    pub fn execute(&self, request: GraphQLRequest) -> GraphQLResponse {
        // Parse the query
        let document = match GraphQLParser::parse(&request) {
            Ok(doc) => doc,
            Err(err) => return GraphQLResponse::error(err),
        };

        // Extract variables
        let variables = self.extract_variables(&request);

        // Execute the operation
        match self.execute_operation(&document, &variables) {
            Ok(data) => GraphQLResponse::success(data.into()),
            Err(err) => GraphQLResponse::error(err),
        }
    }

    fn extract_variables(&self, request: &GraphQLRequest) -> HashMap<String, Value> {
        request
            .variables
            .as_ref()
            .and_then(|v| v.as_object())
            .map(|obj| {
                obj.iter()
                    .map(|(k, v)| (k.clone(), v.clone()))
                    .collect()
            })
            .unwrap_or_default()
    }

    fn execute_operation(
        &self,
        document: &Document,
        variables: &HashMap<String, Value>,
    ) -> Result<GraphQLValue, GraphQLError> {
        for definition in &document.definitions {
            if let Definition::Operation(operation) = definition {
                return self.execute_operation_definition(operation, variables);
            }
        }
        Err(GraphQLError::new("No operation found"))
    }

    fn execute_operation_definition(
        &self,
        operation: &OperationDefinition,
        variables: &HashMap<String, Value>,
    ) -> Result<GraphQLValue, GraphQLError> {
        let operation_type = match operation.operation_type {
            crate::graphql::AstOperationType::Query => OperationType::Query,
            crate::graphql::AstOperationType::Mutation => OperationType::Mutation,
            crate::graphql::AstOperationType::Subscription => OperationType::Subscription,
        };
        let selection_set = &operation.selection_set;

        match operation_type {
            OperationType::Query => {
                self.execute_selection_set(
                    selection_set,
                    &self.schema.query_type.name,
                    None,
                    variables,
                )
            }
            OperationType::Mutation => {
                if let Some(ref mutation_type) = self.schema.mutation_type {
                    self.execute_selection_set(
                        selection_set,
                        &mutation_type.name,
                        None,
                        variables,
                    )
                } else {
                    Err(GraphQLError::new("Schema does not support mutations"))
                }
            }
            OperationType::Subscription => {
                Err(GraphQLError::new("Subscriptions not supported"))
            }
        }
    }

    fn execute_selection_set(
        &self,
        selection_set: &SelectionSet,
        type_name: &str,
        parent: Option<Value>,
        variables: &HashMap<String, Value>,
    ) -> Result<GraphQLValue, GraphQLError> {
        let mut result = HashMap::new();

        for selection in &selection_set.selections {
            match selection {
                Selection::Field(field) => {
                    let field_result = self
                        .execute_field(field, type_name, parent.clone(), variables)?;
                    result.insert(field.name.clone(), field_result);
                }
                Selection::InlineFragment(inline_fragment) => {
                    // For simplicity, we'll execute inline fragments as if they match
                    let fragment_result = self
                        .execute_selection_set(
                            &inline_fragment.selection_set,
                            type_name,
                            parent.clone(),
                            variables,
                        )?;
                    
                    if let GraphQLValue::Object(fragment_map) = fragment_result {
                        result.extend(fragment_map);
                    }
                }
                Selection::FragmentSpread(_) => {
                    // Fragment spreads would need fragment definitions to be resolved
                    // For now, we'll skip them
                }
            }
        }

        Ok(GraphQLValue::Object(result))
    }

    fn execute_field(
        &self,
        field: &AstField,
        type_name: &str,
        parent: Option<Value>,
        variables: &HashMap<String, Value>,
    ) -> Result<GraphQLValue, GraphQLError> {
        // Get resolver for this type and field
        let resolver = self
            .resolvers
            .get(type_name)
            .and_then(|type_resolvers| type_resolvers.get(&field.name))
            .ok_or_else(|| {
                GraphQLError::new(format!(
                    "No resolver found for field '{}' on type '{}'",
                    field.name, type_name
                ))
            })?;

        // Prepare arguments
        let arguments = self.resolve_arguments(&field.arguments, variables)?;

        // Create resolver context
        let context = ResolverContext {
            field_name: field.name.clone(),
            arguments,
            parent,
            variables: variables.clone(),
        };

        // Execute resolver
        let field_value = resolver(&context)?;

        // If the field has a selection set, execute it recursively
        if let Some(ref selection_set) = field.selection_set {
            if selection_set.selections.is_empty() {
                return Ok(field_value);
            }
        } else {
            return Ok(field_value);
        }

        // We need to determine the return type of this field
        // For now, we'll use a simple mapping: field name capitalized = type name
        let field_type_name = capitalize_first_letter(&field.name); // e.g., "user" -> "User"
        
        match field_value {
            GraphQLValue::Object(_) => {
                self.execute_selection_set(
                    field.selection_set.as_ref().unwrap(),
                    &field_type_name,
                    Some(field_value.into()),
                    variables,
                )
            }
            GraphQLValue::List(list) => {
                let mut result_list = Vec::new();
                for item in list {
                    if let GraphQLValue::Object(_) = item {
                        let item_result = self
                            .execute_selection_set(
                                field.selection_set.as_ref().unwrap(),
                                &field_type_name,
                                Some(item.into()),
                                variables,
                            )?;
                        result_list.push(item_result);
                    } else {
                        result_list.push(item);
                    }
                }
                Ok(GraphQLValue::List(result_list))
            }
            _ => Ok(field_value),
        }
    }

    fn resolve_arguments(
        &self,
        arguments: &Vec<crate::graphql::AstArgument>,
        variables: &HashMap<String, Value>,
    ) -> Result<HashMap<String, Value>, GraphQLError> {
        let mut resolved_args = HashMap::new();

        for argument in arguments {
            let resolved_value = self.resolve_value(&argument.value, variables)?;
            resolved_args.insert(argument.name.clone(), resolved_value);
        }

        Ok(resolved_args)
    }

    fn resolve_value(
        &self,
        value: &AstValue,
        variables: &HashMap<String, Value>,
    ) -> Result<Value, GraphQLError> {
        match value {
            AstValue::Variable(var) => {
                variables
                    .get(&var.name)
                    .cloned()
                    .ok_or_else(|| GraphQLError::new(format!("Variable '{}' not provided", var.name)))
            }
            AstValue::IntValue(i) => Ok(json!(i)),
            AstValue::FloatValue(f) => Ok(json!(f)),
            AstValue::StringValue(s) => Ok(json!(s)),
            AstValue::BooleanValue(b) => Ok(json!(b)),
            AstValue::NullValue => Ok(Value::Null),
            AstValue::EnumValue(e) => Ok(json!(e)),
            AstValue::ListValue(list) => {
                let mut result = Vec::new();
                for item in list {
                    result.push(self.resolve_value(item, variables)?);
                }
                Ok(json!(result))
            }
            AstValue::ObjectValue(obj) => {
                let mut result = serde_json::Map::new();
                for (key, val) in obj {
                    result.insert(key.clone(), self.resolve_value(val, variables)?);
                }
                Ok(Value::Object(result))
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::graphql::{ObjectType, ScalarType, Field as SchemaField, GraphQLType};

    #[test]
    fn test_executor_creation() {
        let query_type = ObjectType::new("Query");
        let schema = GraphQLSchema::new(query_type);
        let executor = GraphQLExecutor::new(schema);
        
        assert_eq!(executor.schema.query_type.name, "Query");
    }

    #[test]
    fn test_add_resolver() {
        let query_type = ObjectType::new("Query")
            .add_field("hello", SchemaField::new(GraphQLType::Scalar(ScalarType::string())));
        let schema = GraphQLSchema::new(query_type);
        let mut executor = GraphQLExecutor::new(schema);
        
        executor.add_resolver("Query", "hello", |_| {
            Ok(GraphQLValue::String("Hello, World!".to_string()))
        });
        
        assert!(executor.resolvers.contains_key("Query"));
        assert!(executor.resolvers["Query"].contains_key("hello"));
    }
}