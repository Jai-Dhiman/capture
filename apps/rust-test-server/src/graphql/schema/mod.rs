/*!
# GraphQL Schema Module

This module contains the GraphQL schema definition and type system.

## Components

- Schema definition and validation
- Type system implementation
- Field and argument definitions
- Schema introspection support

## Usage

```rust
use crate::graphql::schema::*;

let schema = GraphQLSchema::new(query_type)
    .add_mutation_type(mutation_type)
    .add_subscription_type(subscription_type);
```
*/

mod schema;

pub use schema::*;