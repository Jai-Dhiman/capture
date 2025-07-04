/*!
# GraphQL Types Module

This module contains the GraphQL type system and value representations.

## Components

- Core GraphQL types (String, Int, Boolean, Float, ID)
- Complex types (Object, List, NonNull, Union, Interface)
- Value representation system
- Type validation and coercion

## Usage

```rust
use crate::graphql::types::*;

let string_type = GraphQLType::Scalar(ScalarType::string());
let response = GraphQLResponse::new(data, errors);
```
*/

mod types;

pub use types::*;