use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone)]
pub struct GraphQLSchema {
    pub query_type: ObjectType,
    pub mutation_type: Option<ObjectType>,
    pub subscription_type: Option<ObjectType>,
    pub types: HashMap<String, GraphQLType>,
}

impl GraphQLSchema {
    pub fn new(query_type: ObjectType) -> Self {
        let mut types = HashMap::new();
        types.insert(query_type.name.clone(), GraphQLType::Object(query_type.clone()));

        Self {
            query_type,
            mutation_type: None,
            subscription_type: None,
            types,
        }
    }

    pub fn with_mutation(mut self, mutation_type: ObjectType) -> Self {
        self.types.insert(
            mutation_type.name.clone(),
            GraphQLType::Object(mutation_type.clone()),
        );
        self.mutation_type = Some(mutation_type);
        self
    }

    pub fn with_subscription(mut self, subscription_type: ObjectType) -> Self {
        self.types.insert(
            subscription_type.name.clone(),
            GraphQLType::Object(subscription_type.clone()),
        );
        self.subscription_type = Some(subscription_type);
        self
    }

    pub fn add_type(&mut self, name: String, type_def: GraphQLType) {
        self.types.insert(name, type_def);
    }

    pub fn get_type(&self, name: &str) -> Option<&GraphQLType> {
        self.types.get(name)
    }
}

#[derive(Debug, Clone)]
pub enum GraphQLType {
    Scalar(ScalarType),
    Object(ObjectType),
    Interface(InterfaceType),
    Union(UnionType),
    Enum(EnumType),
    InputObject(InputObjectType),
    List(Box<GraphQLType>),
    NonNull(Box<GraphQLType>),
}

impl GraphQLType {
    pub fn name(&self) -> Option<&str> {
        match self {
            GraphQLType::Scalar(s) => Some(&s.name),
            GraphQLType::Object(o) => Some(&o.name),
            GraphQLType::Interface(i) => Some(&i.name),
            GraphQLType::Union(u) => Some(&u.name),
            GraphQLType::Enum(e) => Some(&e.name),
            GraphQLType::InputObject(io) => Some(&io.name),
            GraphQLType::List(_) => None,
            GraphQLType::NonNull(_) => None,
        }
    }

    pub fn is_scalar(&self) -> bool {
        matches!(self, GraphQLType::Scalar(_))
    }

    pub fn is_object(&self) -> bool {
        matches!(self, GraphQLType::Object(_))
    }

    pub fn is_input_type(&self) -> bool {
        match self {
            GraphQLType::Scalar(_) | GraphQLType::Enum(_) | GraphQLType::InputObject(_) => true,
            GraphQLType::List(inner) => inner.is_input_type(),
            GraphQLType::NonNull(inner) => inner.is_input_type(),
            _ => false,
        }
    }

    pub fn is_output_type(&self) -> bool {
        match self {
            GraphQLType::Scalar(_)
            | GraphQLType::Object(_)
            | GraphQLType::Interface(_)
            | GraphQLType::Union(_)
            | GraphQLType::Enum(_) => true,
            GraphQLType::List(inner) => inner.is_output_type(),
            GraphQLType::NonNull(inner) => inner.is_output_type(),
            GraphQLType::InputObject(_) => false,
        }
    }
}

#[derive(Debug, Clone)]
pub struct ScalarType {
    pub name: String,
    pub description: Option<String>,
}

impl ScalarType {
    pub fn new(name: impl Into<String>) -> Self {
        Self {
            name: name.into(),
            description: None,
        }
    }

    pub fn with_description(mut self, description: impl Into<String>) -> Self {
        self.description = Some(description.into());
        self
    }

    pub fn string() -> Self {
        Self::new("String").with_description("Built-in String scalar")
    }

    pub fn int() -> Self {
        Self::new("Int").with_description("Built-in Int scalar")
    }

    pub fn float() -> Self {
        Self::new("Float").with_description("Built-in Float scalar")
    }

    pub fn boolean() -> Self {
        Self::new("Boolean").with_description("Built-in Boolean scalar")
    }

    pub fn id() -> Self {
        Self::new("ID").with_description("Built-in ID scalar")
    }
}

#[derive(Debug, Clone)]
pub struct ObjectType {
    pub name: String,
    pub description: Option<String>,
    pub fields: HashMap<String, Field>,
    pub interfaces: Vec<String>,
}

impl ObjectType {
    pub fn new(name: impl Into<String>) -> Self {
        Self {
            name: name.into(),
            description: None,
            fields: HashMap::new(),
            interfaces: Vec::new(),
        }
    }

    pub fn with_description(mut self, description: impl Into<String>) -> Self {
        self.description = Some(description.into());
        self
    }

    pub fn add_field(mut self, name: impl Into<String>, field: Field) -> Self {
        self.fields.insert(name.into(), field);
        self
    }

    pub fn implement_interface(mut self, interface: impl Into<String>) -> Self {
        self.interfaces.push(interface.into());
        self
    }
}

#[derive(Debug, Clone)]
pub struct InterfaceType {
    pub name: String,
    pub description: Option<String>,
    pub fields: HashMap<String, Field>,
}

impl InterfaceType {
    pub fn new(name: impl Into<String>) -> Self {
        Self {
            name: name.into(),
            description: None,
            fields: HashMap::new(),
        }
    }

    pub fn with_description(mut self, description: impl Into<String>) -> Self {
        self.description = Some(description.into());
        self
    }

    pub fn add_field(mut self, name: impl Into<String>, field: Field) -> Self {
        self.fields.insert(name.into(), field);
        self
    }
}

#[derive(Debug, Clone)]
pub struct UnionType {
    pub name: String,
    pub description: Option<String>,
    pub types: Vec<String>,
}

impl UnionType {
    pub fn new(name: impl Into<String>) -> Self {
        Self {
            name: name.into(),
            description: None,
            types: Vec::new(),
        }
    }

    pub fn with_description(mut self, description: impl Into<String>) -> Self {
        self.description = Some(description.into());
        self
    }

    pub fn add_type(mut self, type_name: impl Into<String>) -> Self {
        self.types.push(type_name.into());
        self
    }
}

#[derive(Debug, Clone)]
pub struct EnumType {
    pub name: String,
    pub description: Option<String>,
    pub values: HashMap<String, EnumValue>,
}

impl EnumType {
    pub fn new(name: impl Into<String>) -> Self {
        Self {
            name: name.into(),
            description: None,
            values: HashMap::new(),
        }
    }

    pub fn with_description(mut self, description: impl Into<String>) -> Self {
        self.description = Some(description.into());
        self
    }

    pub fn add_value(mut self, name: impl Into<String>, value: EnumValue) -> Self {
        self.values.insert(name.into(), value);
        self
    }
}

#[derive(Debug, Clone)]
pub struct EnumValue {
    pub description: Option<String>,
    pub deprecation_reason: Option<String>,
}

impl EnumValue {
    pub fn new() -> Self {
        Self {
            description: None,
            deprecation_reason: None,
        }
    }

    pub fn with_description(mut self, description: impl Into<String>) -> Self {
        self.description = Some(description.into());
        self
    }

    pub fn deprecated(mut self, reason: impl Into<String>) -> Self {
        self.deprecation_reason = Some(reason.into());
        self
    }
}

#[derive(Debug, Clone)]
pub struct InputObjectType {
    pub name: String,
    pub description: Option<String>,
    pub fields: HashMap<String, InputField>,
}

impl InputObjectType {
    pub fn new(name: impl Into<String>) -> Self {
        Self {
            name: name.into(),
            description: None,
            fields: HashMap::new(),
        }
    }

    pub fn with_description(mut self, description: impl Into<String>) -> Self {
        self.description = Some(description.into());
        self
    }

    pub fn add_field(mut self, name: impl Into<String>, field: InputField) -> Self {
        self.fields.insert(name.into(), field);
        self
    }
}

#[derive(Debug, Clone)]
pub struct Field {
    pub field_type: GraphQLType,
    pub description: Option<String>,
    pub args: HashMap<String, InputField>,
    pub deprecation_reason: Option<String>,
}

impl Field {
    pub fn new(field_type: GraphQLType) -> Self {
        Self {
            field_type,
            description: None,
            args: HashMap::new(),
            deprecation_reason: None,
        }
    }

    pub fn with_description(mut self, description: impl Into<String>) -> Self {
        self.description = Some(description.into());
        self
    }

    pub fn add_arg(mut self, name: impl Into<String>, arg: InputField) -> Self {
        self.args.insert(name.into(), arg);
        self
    }

    pub fn deprecated(mut self, reason: impl Into<String>) -> Self {
        self.deprecation_reason = Some(reason.into());
        self
    }
}

#[derive(Debug, Clone)]
pub struct InputField {
    pub field_type: GraphQLType,
    pub description: Option<String>,
    pub default_value: Option<serde_json::Value>,
}

impl InputField {
    pub fn new(field_type: GraphQLType) -> Self {
        Self {
            field_type,
            description: None,
            default_value: None,
        }
    }

    pub fn with_description(mut self, description: impl Into<String>) -> Self {
        self.description = Some(description.into());
        self
    }

    pub fn with_default(mut self, value: serde_json::Value) -> Self {
        self.default_value = Some(value);
        self
    }
}

#[derive(Debug, Clone)]
pub struct Directive {
    pub name: String,
    pub description: Option<String>,
    pub locations: Vec<DirectiveLocation>,
    pub args: HashMap<String, InputField>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum DirectiveLocation {
    Query,
    Mutation,
    Subscription,
    Field,
    FragmentDefinition,
    FragmentSpread,
    InlineFragment,
    Schema,
    Scalar,
    Object,
    FieldDefinition,
    ArgumentDefinition,
    Interface,
    Union,
    Enum,
    EnumValue,
    InputObject,
    InputFieldDefinition,
}