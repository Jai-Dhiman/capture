pub mod api;
pub mod ast;
pub mod custom_parser;
pub mod docs;
pub mod engine;
pub mod error_collection;
pub mod examples;
pub mod integration_tests;
pub mod lexer;
pub mod manual_test;
pub mod parser;
pub mod resolvers;
pub mod result_formatter;
pub mod schema;
pub mod types;
pub mod validation;

#[cfg(test)]
mod tests;

pub use ast::{
    Document, Definition, OperationDefinition, VariableDefinition, Variable, SelectionSet, 
    Selection, FragmentSpread, InlineFragment, FragmentDefinition, Directive, Value, Type,
    Field as AstField, Argument as AstArgument, OperationType as AstOperationType
};
pub use custom_parser::Parser as CustomParser;
pub use engine::{
    ExecutionContext, ExecutionPath, VariableManager, FragmentManager,
    GraphQLExecutor, ResolverContext,
    FieldResolver, FieldContext, FieldResolutionInfo, ResolverRegistry,
    SyncFieldResolver, AsyncFieldResolver, ScalarResolvers, ObjectFieldResolver, ListFieldResolver,
    QueryExecutor
};
pub use lexer::{Lexer, Token, Position};
pub use parser::{GraphQLParser, OperationType};
pub use schema::*;
pub use types::*;
pub use validation::{Validator, ValidationContext};
pub use error_collection::{
    GraphQLErrorCollection, EnhancedGraphQLError, ErrorCategory, ErrorSeverity, ExecutionPathBuilder
};
pub use result_formatter::{ResultFormatter, utils as result_utils};

// High-level API exports for easy access
pub use api::{
    GraphQLEngine, execute_query_simple, parse_query, validate_query,
    create_simple_schema, create_demo_schema, create_demo_engine,
    utils as api_utils
};

// Resolvers export - new modular resolver structure
pub use resolvers::{
    create_social_media_schema, create_graphql_engine_with_all_resolvers, add_health_check_resolvers
};