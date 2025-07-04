use crate::graphql::lexer::Position;
use std::collections::HashMap;

#[derive(Debug, Clone, PartialEq)]
pub struct Document {
    pub definitions: Vec<Definition>,
}

#[derive(Debug, Clone, PartialEq)]
pub enum Definition {
    Operation(OperationDefinition),
    Fragment(FragmentDefinition),
}

#[derive(Debug, Clone, PartialEq)]
pub struct OperationDefinition {
    pub operation_type: OperationType,
    pub name: Option<String>,
    pub variable_definitions: Vec<VariableDefinition>,
    pub directives: Vec<Directive>,
    pub selection_set: SelectionSet,
    pub position: Position,
}

#[derive(Debug, Clone, PartialEq)]
pub enum OperationType {
    Query,
    Mutation,
    Subscription,
}

#[derive(Debug, Clone, PartialEq)]
pub struct VariableDefinition {
    pub variable: Variable,
    pub type_: Type,
    pub default_value: Option<Value>,
    pub directives: Vec<Directive>,
    pub position: Position,
}

#[derive(Debug, Clone, PartialEq)]
pub struct Variable {
    pub name: String,
    pub position: Position,
}

#[derive(Debug, Clone, PartialEq)]
pub struct SelectionSet {
    pub selections: Vec<Selection>,
    pub position: Position,
}

#[derive(Debug, Clone, PartialEq)]
pub enum Selection {
    Field(Field),
    FragmentSpread(FragmentSpread),
    InlineFragment(InlineFragment),
}

#[derive(Debug, Clone, PartialEq)]
pub struct Field {
    pub alias: Option<String>,
    pub name: String,
    pub arguments: Vec<Argument>,
    pub directives: Vec<Directive>,
    pub selection_set: Option<SelectionSet>,
    pub position: Position,
}

#[derive(Debug, Clone, PartialEq)]
pub struct Argument {
    pub name: String,
    pub value: Value,
    pub position: Position,
}

#[derive(Debug, Clone, PartialEq)]
pub struct FragmentSpread {
    pub fragment_name: String,
    pub directives: Vec<Directive>,
    pub position: Position,
}

#[derive(Debug, Clone, PartialEq)]
pub struct InlineFragment {
    pub type_condition: Option<String>,
    pub directives: Vec<Directive>,
    pub selection_set: SelectionSet,
    pub position: Position,
}

#[derive(Debug, Clone, PartialEq)]
pub struct FragmentDefinition {
    pub name: String,
    pub type_condition: String,
    pub directives: Vec<Directive>,
    pub selection_set: SelectionSet,
    pub position: Position,
}

#[derive(Debug, Clone, PartialEq)]
pub struct Directive {
    pub name: String,
    pub arguments: Vec<Argument>,
    pub position: Position,
}

#[derive(Debug, Clone, PartialEq)]
pub enum Value {
    Variable(Variable),
    IntValue(i64),
    FloatValue(f64),
    StringValue(String),
    BooleanValue(bool),
    NullValue,
    EnumValue(String),
    ListValue(Vec<Value>),
    ObjectValue(HashMap<String, Value>),
}

#[derive(Debug, Clone, PartialEq)]
pub enum Type {
    Named(String),
    List(Box<Type>),
    NonNull(Box<Type>),
}

impl Type {
    pub fn is_non_null(&self) -> bool {
        matches!(self, Type::NonNull(_))
    }
    
    pub fn is_list(&self) -> bool {
        match self {
            Type::List(_) => true,
            Type::NonNull(inner) => inner.is_list(),
            _ => false,
        }
    }
    
    pub fn inner_type(&self) -> &Type {
        match self {
            Type::NonNull(inner) => inner.inner_type(),
            Type::List(inner) => inner.inner_type(),
            _ => self,
        }
    }
    
    pub fn to_string(&self) -> String {
        match self {
            Type::Named(name) => name.clone(),
            Type::List(inner) => format!("[{}]", inner.to_string()),
            Type::NonNull(inner) => format!("{}!", inner.to_string()),
        }
    }
}

impl Document {
    pub fn new(definitions: Vec<Definition>) -> Self {
        Self { definitions }
    }
    
    pub fn operations(&self) -> impl Iterator<Item = &OperationDefinition> {
        self.definitions.iter().filter_map(|def| match def {
            Definition::Operation(op) => Some(op),
            _ => None,
        })
    }
    
    pub fn fragments(&self) -> impl Iterator<Item = &FragmentDefinition> {
        self.definitions.iter().filter_map(|def| match def {
            Definition::Fragment(frag) => Some(frag),
            _ => None,
        })
    }
}

impl OperationDefinition {
    pub fn new(
        operation_type: OperationType,
        name: Option<String>,
        variable_definitions: Vec<VariableDefinition>,
        directives: Vec<Directive>,
        selection_set: SelectionSet,
        position: Position,
    ) -> Self {
        Self {
            operation_type,
            name,
            variable_definitions,
            directives,
            selection_set,
            position,
        }
    }
}

impl Field {
    pub fn new(
        alias: Option<String>,
        name: String,
        arguments: Vec<Argument>,
        directives: Vec<Directive>,
        selection_set: Option<SelectionSet>,
        position: Position,
    ) -> Self {
        Self {
            alias,
            name,
            arguments,
            directives,
            selection_set,
            position,
        }
    }
    
    pub fn response_name(&self) -> &str {
        self.alias.as_ref().unwrap_or(&self.name)
    }
}

impl SelectionSet {
    pub fn new(selections: Vec<Selection>, position: Position) -> Self {
        Self { selections, position }
    }
    
    pub fn is_empty(&self) -> bool {
        self.selections.is_empty()
    }
}

impl Value {
    pub fn is_null(&self) -> bool {
        matches!(self, Value::NullValue)
    }
    
    pub fn is_variable(&self) -> bool {
        matches!(self, Value::Variable(_))
    }
    
    pub fn as_string(&self) -> Option<&str> {
        match self {
            Value::StringValue(s) => Some(s),
            Value::EnumValue(s) => Some(s),
            _ => None,
        }
    }
    
    pub fn as_int(&self) -> Option<i64> {
        match self {
            Value::IntValue(i) => Some(*i),
            _ => None,
        }
    }
    
    pub fn as_float(&self) -> Option<f64> {
        match self {
            Value::FloatValue(f) => Some(*f),
            Value::IntValue(i) => Some(*i as f64),
            _ => None,
        }
    }
    
    pub fn as_bool(&self) -> Option<bool> {
        match self {
            Value::BooleanValue(b) => Some(*b),
            _ => None,
        }
    }
}