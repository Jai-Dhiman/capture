/*!
# GraphQL Engine Module

This module contains the core GraphQL execution engine components:

- `executor.rs` - Main GraphQL executor that coordinates query execution
- `query_executor.rs` - Query-specific execution logic
- `execution_context.rs` - Context management for query execution
- `field_resolver.rs` - Field resolution system

## Architecture

```
┌─────────────────────────────────────────────┐
│                GraphQL Engine               │
├─────────────────────────────────────────────┤
│ ┌─────────────┐  ┌─────────────────────────┐ │
│ │  Executor   │  │    Query Executor       │ │
│ │             │  │                         │ │
│ └─────────────┘  └─────────────────────────┘ │
│ ┌─────────────┐  ┌─────────────────────────┐ │
│ │ Execution   │  │   Field Resolver        │ │
│ │ Context     │  │                         │ │
│ └─────────────┘  └─────────────────────────┘ │
└─────────────────────────────────────────────┘
```

## Usage

```rust
use crate::graphql::engine::*;

let executor = GraphQLExecutor::new(schema);
let response = executor.execute(request);
```
*/

pub mod execution_context;
pub mod executor;
pub mod field_resolver;
pub mod query_executor;

// Re-export the main types for easy access
pub use execution_context::{ExecutionContext, ExecutionPath, VariableManager, FragmentManager};
pub use executor::{GraphQLExecutor, ResolverContext};
pub use field_resolver::{
    FieldResolver, FieldContext, FieldResolutionInfo, ResolverRegistry,
    SyncFieldResolver, AsyncFieldResolver, ScalarResolvers, ObjectFieldResolver, ListFieldResolver
};
pub use query_executor::QueryExecutor;