use crate::graphql::{
    ast::{Document, Definition, OperationDefinition, Field, Selection, SelectionSet, 
          FragmentDefinition, FragmentSpread, InlineFragment, Value, Type, Argument, Directive},
    schema::{GraphQLSchema, GraphQLType, Field as SchemaField, InputField},
    types::GraphQLError,
    lexer::Position,
};
use std::collections::HashMap;

pub struct ValidationContext<'a> {
    schema: &'a GraphQLSchema,
    fragments: HashMap<String, &'a FragmentDefinition>,
    variables: HashMap<String, Type>,
    errors: Vec<GraphQLError>,
}

impl<'a> ValidationContext<'a> {
    pub fn new(schema: &'a GraphQLSchema) -> Self {
        Self {
            schema,
            fragments: HashMap::new(),
            variables: HashMap::new(),
            errors: Vec::new(),
        }
    }
    
    pub fn add_error(&mut self, error: GraphQLError) {
        self.errors.push(error);
    }
    
    pub fn get_errors(self) -> Vec<GraphQLError> {
        self.errors
    }
}

pub struct Validator;

impl Validator {
    pub fn validate(schema: &GraphQLSchema, document: &Document) -> Result<(), Vec<GraphQLError>> {
        let mut context = ValidationContext::new(schema);
        
        // Collect fragments first
        for definition in &document.definitions {
            if let Definition::Fragment(fragment) = definition {
                context.fragments.insert(fragment.name.clone(), fragment);
            }
        }
        
        // Validate each operation
        for definition in &document.definitions {
            match definition {
                Definition::Operation(operation) => {
                    Self::validate_operation(&mut context, operation);
                }
                Definition::Fragment(fragment) => {
                    Self::validate_fragment(&mut context, fragment);
                }
            }
        }
        
        if context.errors.is_empty() {
            Ok(())
        } else {
            Err(context.get_errors())
        }
    }
    
    fn validate_operation(context: &mut ValidationContext, operation: &OperationDefinition) {
        // Collect variables for this operation
        context.variables.clear();
        for var_def in &operation.variable_definitions {
            context.variables.insert(var_def.variable.name.clone(), var_def.type_.clone());
        }
        
        // Get the root type for this operation
        let root_type = match operation.operation_type {
            crate::graphql::ast::OperationType::Query => &context.schema.query_type,
            crate::graphql::ast::OperationType::Mutation => {
                match &context.schema.mutation_type {
                    Some(mutation_type) => mutation_type,
                    None => {
                        context.add_error(GraphQLError::new(
                            "Schema does not support mutations"
                        ).with_location(operation.position.line, operation.position.column));
                        return;
                    }
                }
            }
            crate::graphql::ast::OperationType::Subscription => {
                match &context.schema.subscription_type {
                    Some(subscription_type) => subscription_type,
                    None => {
                        context.add_error(GraphQLError::new(
                            "Schema does not support subscriptions"
                        ).with_location(operation.position.line, operation.position.column));
                        return;
                    }
                }
            }
        };
        
        // Validate the selection set
        let root_type_ref = GraphQLType::Object(root_type.clone());
        Self::validate_selection_set(
            context,
            &operation.selection_set,
            &root_type_ref,
        );
        
        // Validate directives
        for directive in &operation.directives {
            Self::validate_directive(context, directive);
        }
    }
    
    fn validate_fragment(context: &mut ValidationContext, fragment: &FragmentDefinition) {
        // Check if the type condition exists in the schema
        if !context.schema.types.contains_key(&fragment.type_condition) {
            context.add_error(GraphQLError::new(
                format!("Unknown type '{}'", fragment.type_condition)
            ).with_location(fragment.position.line, fragment.position.column));
            return;
        }
        
        let fragment_type = context.schema.types.get(&fragment.type_condition).unwrap();
        
        // Validate the selection set
        Self::validate_selection_set(context, &fragment.selection_set, fragment_type);
        
        // Validate directives
        for directive in &fragment.directives {
            Self::validate_directive(context, directive);
        }
    }
    
    fn validate_selection_set(
        context: &mut ValidationContext,
        selection_set: &SelectionSet,
        parent_type: &GraphQLType,
    ) {
        for selection in &selection_set.selections {
            match selection {
                Selection::Field(field) => {
                    Self::validate_field(context, field, parent_type);
                }
                Selection::FragmentSpread(fragment_spread) => {
                    Self::validate_fragment_spread(context, fragment_spread, parent_type);
                }
                Selection::InlineFragment(inline_fragment) => {
                    Self::validate_inline_fragment(context, inline_fragment, parent_type);
                }
            }
        }
    }
    
    fn validate_field(context: &mut ValidationContext, field: &Field, parent_type: &GraphQLType) {
        // Check if field exists on parent type
        let field_def = Self::get_field_definition(context, field, parent_type);
        if field_def.is_none() {
            context.add_error(GraphQLError::new(
                format!("Field '{}' does not exist on type '{}'", 
                       field.name, 
                       parent_type.name().unwrap_or("Unknown"))
            ).with_location(field.position.line, field.position.column));
            return;
        }
        
        let field_def = field_def.unwrap();
        
        // Validate arguments
        Self::validate_arguments(context, &field.arguments, &field_def.args, &field.position);
        
        // Validate directives
        for directive in &field.directives {
            Self::validate_directive(context, directive);
        }
        
        // Validate selection set if field returns composite type
        if let Some(selection_set) = &field.selection_set {
            Self::validate_selection_set(context, selection_set, &field_def.field_type);
        } else if Self::is_composite_type(&field_def.field_type) {
            context.add_error(GraphQLError::new(
                format!("Field '{}' returns composite type and must have a selection set", field.name)
            ).with_location(field.position.line, field.position.column));
        }
    }
    
    fn validate_arguments(
        context: &mut ValidationContext,
        arguments: &[Argument],
        field_args: &HashMap<String, InputField>,
        position: &Position,
    ) {
        // Check for unknown arguments
        for arg in arguments {
            if !field_args.contains_key(&arg.name) {
                context.add_error(GraphQLError::new(
                    format!("Unknown argument '{}'", arg.name)
                ).with_location(position.line, position.column));
                continue;
            }
            
            let arg_def = field_args.get(&arg.name).unwrap();
            
            // Validate argument type compatibility
            Self::validate_argument_type(context, &arg.value, &arg_def.field_type, &arg.position);
        }
        
        // Check for missing required arguments
        for (arg_name, arg_def) in field_args {
            if Self::is_required_type(&arg_def.field_type) && arg_def.default_value.is_none() {
                let provided = arguments.iter().any(|a| a.name == *arg_name);
                if !provided {
                    context.add_error(GraphQLError::new(
                        format!("Required argument '{}' is missing", arg_name)
                    ).with_location(position.line, position.column));
                }
            }
        }
    }
    
    fn validate_argument_type(
        context: &mut ValidationContext,
        value: &Value,
        expected_type: &GraphQLType,
        position: &Position,
    ) {
        match value {
            Value::Variable(var) => {
                // Check if variable exists and has compatible type
                if let Some(var_type) = context.variables.get(&var.name) {
                    if !Self::is_type_compatible(var_type, expected_type) {
                        context.add_error(GraphQLError::new(
                            format!("Variable '{}' type is not compatible with expected type", var.name)
                        ).with_location(position.line, position.column));
                    }
                } else {
                    context.add_error(GraphQLError::new(
                        format!("Undefined variable '{}'", var.name)
                    ).with_location(position.line, position.column));
                }
            }
            Value::NullValue => {
                if Self::is_required_type(expected_type) {
                    context.add_error(GraphQLError::new(
                        "Cannot pass null to non-null type"
                    ).with_location(position.line, position.column));
                }
            }
            Value::ListValue(items) => {
                if let GraphQLType::List(item_type) = expected_type {
                    for item in items {
                        Self::validate_argument_type(context, item, item_type, position);
                    }
                } else if let GraphQLType::NonNull(inner) = expected_type {
                    if let GraphQLType::List(item_type) = inner.as_ref() {
                        for item in items {
                            Self::validate_argument_type(context, item, item_type, position);
                        }
                    }
                }
            }
            _ => {
                // For literal values, we could add more specific type checking here
                // For now, we'll trust that the value is valid for the expected type
            }
        }
    }
    
    fn validate_fragment_spread(
        context: &mut ValidationContext,
        fragment_spread: &FragmentSpread,
        parent_type: &GraphQLType,
    ) {
        // Check if fragment exists
        if let Some(fragment) = context.fragments.get(&fragment_spread.fragment_name) {
            // Check if fragment type is compatible with parent type
            if !Self::is_fragment_applicable(context, &fragment.type_condition, parent_type) {
                context.add_error(GraphQLError::new(
                    format!("Fragment '{}' cannot be applied to type '{}'", 
                           fragment_spread.fragment_name,
                           parent_type.name().unwrap_or("Unknown"))
                ).with_location(fragment_spread.position.line, fragment_spread.position.column));
            }
        } else {
            context.add_error(GraphQLError::new(
                format!("Unknown fragment '{}'", fragment_spread.fragment_name)
            ).with_location(fragment_spread.position.line, fragment_spread.position.column));
        }
        
        // Validate directives
        for directive in &fragment_spread.directives {
            Self::validate_directive(context, directive);
        }
    }
    
    fn validate_inline_fragment(
        context: &mut ValidationContext,
        inline_fragment: &InlineFragment,
        parent_type: &GraphQLType,
    ) {
        let fragment_type = if let Some(type_condition) = &inline_fragment.type_condition {
            // Check if type condition exists
            if !context.schema.types.contains_key(type_condition) {
                context.add_error(GraphQLError::new(
                    format!("Unknown type '{}'", type_condition)
                ).with_location(inline_fragment.position.line, inline_fragment.position.column));
                return;
            }
            
            let fragment_type = context.schema.types.get(type_condition).unwrap();
            
            // Check if fragment type is compatible with parent type
            if !Self::is_fragment_applicable(context, type_condition, parent_type) {
                context.add_error(GraphQLError::new(
                    format!("Inline fragment on type '{}' cannot be applied to type '{}'", 
                           type_condition,
                           parent_type.name().unwrap_or("Unknown"))
                ).with_location(inline_fragment.position.line, inline_fragment.position.column));
            }
            
            fragment_type
        } else {
            parent_type
        };
        
        // Validate the selection set
        Self::validate_selection_set(context, &inline_fragment.selection_set, fragment_type);
        
        // Validate directives
        for directive in &inline_fragment.directives {
            Self::validate_directive(context, directive);
        }
    }
    
    fn validate_directive(_context: &mut ValidationContext, _directive: &Directive) {
        // For now, we'll skip directive validation
        // In a full implementation, we would check if the directive exists
        // and validate its arguments and location
    }
    
    fn get_field_definition<'a>(
        _context: &ValidationContext,
        field: &Field,
        parent_type: &'a GraphQLType,
    ) -> Option<&'a SchemaField> {
        match parent_type {
            GraphQLType::Object(obj_type) => obj_type.fields.get(&field.name),
            GraphQLType::Interface(interface_type) => interface_type.fields.get(&field.name),
            GraphQLType::NonNull(inner) => Self::get_field_definition(_context, field, inner),
            _ => None,
        }
    }
    
    fn is_composite_type(type_: &GraphQLType) -> bool {
        match type_ {
            GraphQLType::Object(_) | GraphQLType::Interface(_) | GraphQLType::Union(_) => true,
            GraphQLType::List(inner) => Self::is_composite_type(inner),
            GraphQLType::NonNull(inner) => Self::is_composite_type(inner),
            _ => false,
        }
    }
    
    fn is_required_type(type_: &GraphQLType) -> bool {
        matches!(type_, GraphQLType::NonNull(_))
    }
    
    fn is_type_compatible(var_type: &Type, expected_type: &GraphQLType) -> bool {
        // This is a simplified type compatibility check
        // In a full implementation, we would need to handle all type combinations
        match (var_type, expected_type) {
            (Type::Named(var_name), GraphQLType::Scalar(scalar)) => var_name == &scalar.name,
            (Type::Named(var_name), GraphQLType::Object(obj)) => var_name == &obj.name,
            (Type::Named(var_name), GraphQLType::Enum(enum_type)) => var_name == &enum_type.name,
            (Type::List(inner_var), GraphQLType::List(inner_expected)) => {
                Self::is_type_compatible(inner_var, inner_expected)
            }
            (Type::NonNull(inner_var), GraphQLType::NonNull(inner_expected)) => {
                Self::is_type_compatible(inner_var, inner_expected)
            }
            _ => false,
        }
    }
    
    fn is_fragment_applicable(
        context: &ValidationContext,
        fragment_type_name: &str,
        parent_type: &GraphQLType,
    ) -> bool {
        // Check if fragment type is the same as parent type
        if let Some(parent_name) = parent_type.name() {
            if parent_name == fragment_type_name {
                return true;
            }
        }
        
        // Check if fragment type is an interface implemented by parent type
        if let GraphQLType::Object(obj_type) = parent_type {
            if obj_type.interfaces.contains(&fragment_type_name.to_string()) {
                return true;
            }
        }
        
        // Check if fragment type is a union member
        if let Some(fragment_type) = context.schema.types.get(fragment_type_name) {
            if let GraphQLType::Union(union_type) = fragment_type {
                if let Some(parent_name) = parent_type.name() {
                    return union_type.types.contains(&parent_name.to_string());
                }
            }
        }
        
        false
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::graphql::{
        schema::{ObjectType, Field as SchemaField, ScalarType, InputField},
        ast::*,
        lexer::Position,
    };
    
    fn create_test_schema() -> GraphQLSchema {
        let string_type = GraphQLType::Scalar(ScalarType::string());
        let int_type = GraphQLType::Scalar(ScalarType::int());
        
        let user_type = ObjectType::new("User")
            .add_field("id", SchemaField::new(GraphQLType::NonNull(Box::new(string_type.clone()))))
            .add_field("name", SchemaField::new(string_type.clone()))
            .add_field("age", SchemaField::new(int_type.clone()));
        
        let query_type = ObjectType::new("Query")
            .add_field("user", SchemaField::new(GraphQLType::Object(user_type.clone()))
                .add_arg("id", InputField::new(GraphQLType::NonNull(Box::new(string_type.clone())))));
        
        let mut schema = GraphQLSchema::new(query_type);
        schema.add_type("User".to_string(), GraphQLType::Object(user_type));
        schema
    }
    
    #[test]
    fn test_valid_query() {
        let schema = create_test_schema();
        let document = Document::new(vec![
            Definition::Operation(OperationDefinition::new(
                OperationType::Query,
                None,
                vec![],
                vec![],
                SelectionSet::new(vec![
                    Selection::Field(Field::new(
                        None,
                        "user".to_string(),
                        vec![Argument {
                            name: "id".to_string(),
                            value: Value::StringValue("123".to_string()),
                            position: Position::new(),
                        }],
                        vec![],
                        Some(SelectionSet::new(vec![
                            Selection::Field(Field::new(
                                None,
                                "name".to_string(),
                                vec![],
                                vec![],
                                None,
                                Position::new(),
                            ))
                        ], Position::new())),
                        Position::new(),
                    ))
                ], Position::new()),
                Position::new(),
            ))
        ]);
        
        let result = Validator::validate(&schema, &document);
        assert!(result.is_ok());
    }
    
    #[test]
    fn test_unknown_field() {
        let schema = create_test_schema();
        let document = Document::new(vec![
            Definition::Operation(OperationDefinition::new(
                OperationType::Query,
                None,
                vec![],
                vec![],
                SelectionSet::new(vec![
                    Selection::Field(Field::new(
                        None,
                        "unknownField".to_string(),
                        vec![],
                        vec![],
                        None,
                        Position::new(),
                    ))
                ], Position::new()),
                Position::new(),
            ))
        ]);
        
        let result = Validator::validate(&schema, &document);
        assert!(result.is_err());
        let errors = result.unwrap_err();
        assert_eq!(errors.len(), 1);
        assert!(errors[0].message.contains("does not exist"));
    }
    
    #[test]
    fn test_missing_required_argument() {
        let schema = create_test_schema();
        let document = Document::new(vec![
            Definition::Operation(OperationDefinition::new(
                OperationType::Query,
                None,
                vec![],
                vec![],
                SelectionSet::new(vec![
                    Selection::Field(Field::new(
                        None,
                        "user".to_string(),
                        vec![], // Missing required "id" argument
                        vec![],
                        Some(SelectionSet::new(vec![
                            Selection::Field(Field::new(
                                None,
                                "name".to_string(),
                                vec![],
                                vec![],
                                None,
                                Position::new(),
                            ))
                        ], Position::new())),
                        Position::new(),
                    ))
                ], Position::new()),
                Position::new(),
            ))
        ]);
        
        let result = Validator::validate(&schema, &document);
        assert!(result.is_err());
        let errors = result.unwrap_err();
        assert_eq!(errors.len(), 1);
        assert!(errors[0].message.contains("Required argument"));
    }
    
    #[test]
    fn test_missing_selection_set() {
        let schema = create_test_schema();
        let document = Document::new(vec![
            Definition::Operation(OperationDefinition::new(
                OperationType::Query,
                None,
                vec![],
                vec![],
                SelectionSet::new(vec![
                    Selection::Field(Field::new(
                        None,
                        "user".to_string(),
                        vec![Argument {
                            name: "id".to_string(),
                            value: Value::StringValue("123".to_string()),
                            position: Position::new(),
                        }],
                        vec![],
                        None, // Missing selection set for composite type
                        Position::new(),
                    ))
                ], Position::new()),
                Position::new(),
            ))
        ]);
        
        let result = Validator::validate(&schema, &document);
        assert!(result.is_err());
        let errors = result.unwrap_err();
        assert_eq!(errors.len(), 1);
        assert!(errors[0].message.contains("must have a selection set"));
    }
}