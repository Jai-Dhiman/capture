use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GraphQLRequest {
    pub query: String,
    pub variables: Option<serde_json::Value>,
    pub operation_name: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GraphQLResponse {
    pub data: Option<serde_json::Value>,
    pub errors: Option<Vec<GraphQLError>>,
    pub extensions: Option<serde_json::Value>,
}

impl GraphQLResponse {
    pub fn success(data: serde_json::Value) -> Self {
        Self {
            data: Some(data),
            errors: None,
            extensions: None,
        }
    }

    pub fn error(error: GraphQLError) -> Self {
        Self {
            data: None,
            errors: Some(vec![error]),
            extensions: None,
        }
    }

    pub fn errors(errors: Vec<GraphQLError>) -> Self {
        Self {
            data: None,
            errors: Some(errors),
            extensions: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GraphQLError {
    pub message: String,
    pub locations: Option<Vec<ErrorLocation>>,
    pub path: Option<Vec<serde_json::Value>>,
    pub extensions: Option<serde_json::Value>,
}

impl GraphQLError {
    pub fn new(message: impl Into<String>) -> Self {
        Self {
            message: message.into(),
            locations: None,
            path: None,
            extensions: None,
        }
    }

    pub fn with_location(mut self, line: u32, column: u32) -> Self {
        self.locations = Some(vec![ErrorLocation { line, column }]);
        self
    }

    pub fn with_path(mut self, path: Vec<serde_json::Value>) -> Self {
        self.path = Some(path);
        self
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ErrorLocation {
    pub line: u32,
    pub column: u32,
}

#[derive(Debug, Clone)]
pub enum GraphQLValue {
    Null,
    String(String),
    Int(i64),
    Float(f64),
    Boolean(bool),
    Enum(String),
    List(Vec<GraphQLValue>),
    Object(HashMap<String, GraphQLValue>),
}

impl From<GraphQLValue> for serde_json::Value {
    fn from(value: GraphQLValue) -> Self {
        match value {
            GraphQLValue::Null => serde_json::Value::Null,
            GraphQLValue::String(s) => serde_json::Value::String(s),
            GraphQLValue::Int(i) => serde_json::Value::Number(i.into()),
            GraphQLValue::Float(f) => {
                serde_json::Value::Number(
                    serde_json::Number::from_f64(f)
                        .unwrap_or_else(|| serde_json::Number::from(0))
                )
            }
            GraphQLValue::Boolean(b) => serde_json::Value::Bool(b),
            GraphQLValue::Enum(s) => serde_json::Value::String(s),
            GraphQLValue::List(list) => {
                serde_json::Value::Array(list.into_iter().map(|v| v.into()).collect())
            }
            GraphQLValue::Object(map) => serde_json::Value::Object(
                map.into_iter()
                    .map(|(k, v)| (k, v.into()))
                    .collect::<serde_json::Map<String, serde_json::Value>>(),
            ),
        }
    }
}

impl From<serde_json::Value> for GraphQLValue {
    fn from(value: serde_json::Value) -> Self {
        match value {
            serde_json::Value::Null => GraphQLValue::Null,
            serde_json::Value::Bool(b) => GraphQLValue::Boolean(b),
            serde_json::Value::Number(n) => {
                if let Some(i) = n.as_i64() {
                    GraphQLValue::Int(i)
                } else if let Some(f) = n.as_f64() {
                    GraphQLValue::Float(f)
                } else {
                    GraphQLValue::Null
                }
            }
            serde_json::Value::String(s) => GraphQLValue::String(s),
            serde_json::Value::Array(arr) => {
                GraphQLValue::List(arr.into_iter().map(|v| v.into()).collect())
            }
            serde_json::Value::Object(obj) => GraphQLValue::Object(
                obj.into_iter().map(|(k, v)| (k, v.into())).collect(),
            ),
        }
    }
}