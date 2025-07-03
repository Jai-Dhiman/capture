use crate::graphql::{
    ast::*,
    lexer::{Lexer, Token, Position},
    GraphQLError
};
use std::collections::HashMap;

pub struct Parser {
    tokens: Vec<Token>,
    current: usize,
    current_pos: Position,
}

impl Parser {
    pub fn new(mut lexer: Lexer) -> Result<Self, GraphQLError> {
        let tokens = lexer.tokenize()?;
        Ok(Self {
            tokens,
            current: 0,
            current_pos: Position::new(),
        })
    }
    
    pub fn parse(&mut self) -> Result<Document, GraphQLError> {
        let mut definitions = Vec::new();
        
        while !self.is_at_end() {
            if self.peek() == &Token::EndOfFile {
                break;
            }
            
            let definition = self.parse_definition()?;
            definitions.push(definition);
        }
        
        Ok(Document::new(definitions))
    }
    
    fn parse_definition(&mut self) -> Result<Definition, GraphQLError> {
        match self.peek() {
            Token::Query | Token::Mutation | Token::Subscription => {
                let operation = self.parse_operation_definition()?;
                Ok(Definition::Operation(operation))
            }
            Token::Fragment => {
                let fragment = self.parse_fragment_definition()?;
                Ok(Definition::Fragment(fragment))
            }
            Token::LeftBrace => {
                // Shorthand query syntax
                let selection_set = self.parse_selection_set()?;
                let operation = OperationDefinition::new(
                    OperationType::Query,
                    None,
                    Vec::new(),
                    Vec::new(),
                    selection_set,
                    self.current_pos.clone(),
                );
                Ok(Definition::Operation(operation))
            }
            _ => Err(self.error("Expected operation or fragment definition")),
        }
    }
    
    fn parse_operation_definition(&mut self) -> Result<OperationDefinition, GraphQLError> {
        let position = self.current_pos.clone();
        
        // Parse operation type
        let operation_type = match self.advance() {
            Token::Query => OperationType::Query,
            Token::Mutation => OperationType::Mutation,
            Token::Subscription => OperationType::Subscription,
            _ => return Err(self.error("Expected operation type")),
        };
        
        // Parse operation name (optional)
        let name = if let Token::Name(name) = self.peek() {
            let name = name.clone();
            self.advance();
            Some(name)
        } else {
            None
        };
        
        // Parse variable definitions (optional)
        let variable_definitions = if self.peek() == &Token::LeftParen {
            self.parse_variable_definitions()?
        } else {
            Vec::new()
        };
        
        // Parse directives (optional)
        let directives = self.parse_directives()?;
        
        // Parse selection set
        let selection_set = self.parse_selection_set()?;
        
        Ok(OperationDefinition::new(
            operation_type,
            name,
            variable_definitions,
            directives,
            selection_set,
            position,
        ))
    }
    
    fn parse_fragment_definition(&mut self) -> Result<FragmentDefinition, GraphQLError> {
        let position = self.current_pos.clone();
        
        // Consume 'fragment' keyword
        self.consume(Token::Fragment, "Expected 'fragment'")?;
        
        // Parse fragment name
        let name = if let Token::Name(name) = self.advance() {
            name.clone()
        } else {
            return Err(self.error("Expected fragment name"));
        };
        
        // Consume 'on' keyword
        self.consume(Token::On, "Expected 'on'")?;
        
        // Parse type condition
        let type_condition = if let Token::Name(type_name) = self.advance() {
            type_name.clone()
        } else {
            return Err(self.error("Expected type condition"));
        };
        
        // Parse directives (optional)
        let directives = self.parse_directives()?;
        
        // Parse selection set
        let selection_set = self.parse_selection_set()?;
        
        Ok(FragmentDefinition {
            name,
            type_condition,
            directives,
            selection_set,
            position,
        })
    }
    
    fn parse_variable_definitions(&mut self) -> Result<Vec<VariableDefinition>, GraphQLError> {
        self.consume(Token::LeftParen, "Expected '('")?;
        
        let mut variable_definitions = Vec::new();
        
        while self.peek() != &Token::RightParen && !self.is_at_end() {
            let var_def = self.parse_variable_definition()?;
            variable_definitions.push(var_def);
            
            if self.peek() == &Token::Comma {
                self.advance();
            } else if self.peek() != &Token::RightParen {
                return Err(self.error("Expected ',' or ')' in variable definitions"));
            }
        }
        
        self.consume(Token::RightParen, "Expected ')'")?;
        
        Ok(variable_definitions)
    }
    
    fn parse_variable_definition(&mut self) -> Result<VariableDefinition, GraphQLError> {
        let position = self.current_pos.clone();
        
        // Parse variable
        let variable = self.parse_variable()?;
        
        // Consume ':'
        self.consume(Token::Colon, "Expected ':' after variable")?;
        
        // Parse type
        let type_ = self.parse_type()?;
        
        // Parse default value (optional)
        let default_value = if self.peek() == &Token::Equals {
            self.advance();
            Some(self.parse_value()?)
        } else {
            None
        };
        
        // Parse directives (optional)
        let directives = self.parse_directives()?;
        
        Ok(VariableDefinition {
            variable,
            type_,
            default_value,
            directives,
            position,
        })
    }
    
    fn parse_variable(&mut self) -> Result<Variable, GraphQLError> {
        let position = self.current_pos.clone();
        
        self.consume(Token::Dollar, "Expected '$' for variable")?;
        
        let name = if let Token::Name(name) = self.advance() {
            name.clone()
        } else {
            return Err(self.error("Expected variable name"));
        };
        
        Ok(Variable { name, position })
    }
    
    fn parse_type(&mut self) -> Result<Type, GraphQLError> {
        let mut type_ = match self.advance() {
            Token::Name(name) => Type::Named(name.clone()),
            Token::LeftBracket => {
                let inner_type = self.parse_type()?;
                self.consume(Token::RightBracket, "Expected ']' after list type")?;
                Type::List(Box::new(inner_type))
            }
            _ => return Err(self.error("Expected type name or '['")),
        };
        
        // Handle non-null modifier
        if self.peek() == &Token::Exclamation {
            self.advance();
            type_ = Type::NonNull(Box::new(type_));
        }
        
        Ok(type_)
    }
    
    fn parse_selection_set(&mut self) -> Result<SelectionSet, GraphQLError> {
        let position = self.current_pos.clone();
        
        self.consume(Token::LeftBrace, "Expected '{'")?;
        
        let mut selections = Vec::new();
        
        while self.peek() != &Token::RightBrace && !self.is_at_end() {
            let selection = self.parse_selection()?;
            selections.push(selection);
        }
        
        self.consume(Token::RightBrace, "Expected '}'")?;
        
        Ok(SelectionSet::new(selections, position))
    }
    
    fn parse_selection(&mut self) -> Result<Selection, GraphQLError> {
        match self.peek() {
            Token::Ellipsis => {
                self.advance();
                if self.peek() == &Token::On {
                    // Inline fragment
                    let inline_fragment = self.parse_inline_fragment()?;
                    Ok(Selection::InlineFragment(inline_fragment))
                } else if let Token::Name(_) = self.peek() {
                    // Fragment spread
                    let fragment_spread = self.parse_fragment_spread()?;
                    Ok(Selection::FragmentSpread(fragment_spread))
                } else {
                    Err(self.error("Expected fragment name or 'on' after '...'"))
                }
            }
            Token::Name(_) => {
                let field = self.parse_field()?;
                Ok(Selection::Field(field))
            }
            _ => Err(self.error("Expected field or fragment")),
        }
    }
    
    fn parse_field(&mut self) -> Result<Field, GraphQLError> {
        let position = self.current_pos.clone();
        
        // Parse field name (possibly with alias)
        let first_name = if let Token::Name(name) = self.advance() {
            name.clone()
        } else {
            return Err(self.error("Expected field name"));
        };
        
        let (alias, name) = if self.peek() == &Token::Colon {
            // This is an alias
            self.advance(); // consume ':'
            let field_name = if let Token::Name(name) = self.advance() {
                name.clone()
            } else {
                return Err(self.error("Expected field name after alias"));
            };
            (Some(first_name), field_name)
        } else {
            (None, first_name)
        };
        
        // Parse arguments (optional)
        let arguments = if self.peek() == &Token::LeftParen {
            self.parse_arguments()?
        } else {
            Vec::new()
        };
        
        // Parse directives (optional)
        let directives = self.parse_directives()?;
        
        // Parse selection set (optional)
        let selection_set = if self.peek() == &Token::LeftBrace {
            Some(self.parse_selection_set()?)
        } else {
            None
        };
        
        Ok(Field::new(alias, name, arguments, directives, selection_set, position))
    }
    
    fn parse_arguments(&mut self) -> Result<Vec<Argument>, GraphQLError> {
        self.consume(Token::LeftParen, "Expected '('")?;
        
        let mut arguments = Vec::new();
        
        while self.peek() != &Token::RightParen && !self.is_at_end() {
            let argument = self.parse_argument()?;
            arguments.push(argument);
            
            if self.peek() == &Token::Comma {
                self.advance();
            } else if self.peek() != &Token::RightParen {
                return Err(self.error("Expected ',' or ')' in arguments"));
            }
        }
        
        self.consume(Token::RightParen, "Expected ')'")?;
        
        Ok(arguments)
    }
    
    fn parse_argument(&mut self) -> Result<Argument, GraphQLError> {
        let position = self.current_pos.clone();
        
        let name = if let Token::Name(name) = self.advance() {
            name.clone()
        } else {
            return Err(self.error("Expected argument name"));
        };
        
        self.consume(Token::Colon, "Expected ':' after argument name")?;
        
        let value = self.parse_value()?;
        
        Ok(Argument { name, value, position })
    }
    
    fn parse_fragment_spread(&mut self) -> Result<FragmentSpread, GraphQLError> {
        let position = self.current_pos.clone();
        
        let fragment_name = if let Token::Name(name) = self.advance() {
            name.clone()
        } else {
            return Err(self.error("Expected fragment name"));
        };
        
        let directives = self.parse_directives()?;
        
        Ok(FragmentSpread {
            fragment_name,
            directives,
            position,
        })
    }
    
    fn parse_inline_fragment(&mut self) -> Result<InlineFragment, GraphQLError> {
        let position = self.current_pos.clone();
        
        // Consume 'on' keyword
        self.consume(Token::On, "Expected 'on'")?;
        
        // Parse type condition
        let type_condition = if let Token::Name(type_name) = self.advance() {
            Some(type_name.clone())
        } else {
            return Err(self.error("Expected type condition"));
        };
        
        // Parse directives (optional)
        let directives = self.parse_directives()?;
        
        // Parse selection set
        let selection_set = self.parse_selection_set()?;
        
        Ok(InlineFragment {
            type_condition,
            directives,
            selection_set,
            position,
        })
    }
    
    fn parse_directives(&mut self) -> Result<Vec<Directive>, GraphQLError> {
        let mut directives = Vec::new();
        
        while self.peek() == &Token::At {
            let directive = self.parse_directive()?;
            directives.push(directive);
        }
        
        Ok(directives)
    }
    
    fn parse_directive(&mut self) -> Result<Directive, GraphQLError> {
        let position = self.current_pos.clone();
        
        self.consume(Token::At, "Expected '@'")?;
        
        let name = if let Token::Name(name) = self.advance() {
            name.clone()
        } else {
            return Err(self.error("Expected directive name"));
        };
        
        // Parse arguments (optional)
        let arguments = if self.peek() == &Token::LeftParen {
            self.parse_arguments()?
        } else {
            Vec::new()
        };
        
        Ok(Directive { name, arguments, position })
    }
    
    fn parse_value(&mut self) -> Result<Value, GraphQLError> {
        match self.advance() {
            Token::Dollar => {
                // Variable
                let name = if let Token::Name(name) = self.advance() {
                    name.clone()
                } else {
                    return Err(self.error("Expected variable name"));
                };
                Ok(Value::Variable(Variable { name, position: self.current_pos.clone() }))
            }
            Token::IntValue(value) => Ok(Value::IntValue(*value)),
            Token::FloatValue(value) => Ok(Value::FloatValue(*value)),
            Token::StringValue(value) => Ok(Value::StringValue(value.clone())),
            Token::True => Ok(Value::BooleanValue(true)),
            Token::False => Ok(Value::BooleanValue(false)),
            Token::Null => Ok(Value::NullValue),
            Token::Name(name) => Ok(Value::EnumValue(name.clone())),
            Token::LeftBracket => {
                // List value
                let mut values = Vec::new();
                
                while self.peek() != &Token::RightBracket && !self.is_at_end() {
                    let value = self.parse_value()?;
                    values.push(value);
                    
                    if self.peek() == &Token::Comma {
                        self.advance();
                    } else if self.peek() != &Token::RightBracket {
                        return Err(self.error("Expected ',' or ']' in list"));
                    }
                }
                
                self.consume(Token::RightBracket, "Expected ']'")?;
                Ok(Value::ListValue(values))
            }
            Token::LeftBrace => {
                // Object value
                let mut object = HashMap::new();
                
                while self.peek() != &Token::RightBrace && !self.is_at_end() {
                    let key = if let Token::Name(name) = self.advance() {
                        name.clone()
                    } else {
                        return Err(self.error("Expected field name in object"));
                    };
                    
                    self.consume(Token::Colon, "Expected ':' after field name")?;
                    
                    let value = self.parse_value()?;
                    object.insert(key, value);
                    
                    if self.peek() == &Token::Comma {
                        self.advance();
                    } else if self.peek() != &Token::RightBrace {
                        return Err(self.error("Expected ',' or '}' in object"));
                    }
                }
                
                self.consume(Token::RightBrace, "Expected '}'")?;
                Ok(Value::ObjectValue(object))
            }
            _ => Err(self.error("Expected value")),
        }
    }
    
    fn peek(&self) -> &Token {
        self.tokens.get(self.current).unwrap_or(&Token::EndOfFile)
    }
    
    fn advance(&mut self) -> &Token {
        if !self.is_at_end() {
            self.current += 1;
        }
        self.previous()
    }
    
    fn previous(&self) -> &Token {
        &self.tokens[self.current - 1]
    }
    
    fn is_at_end(&self) -> bool {
        self.peek() == &Token::EndOfFile
    }
    
    fn consume(&mut self, token: Token, message: &str) -> Result<(), GraphQLError> {
        if self.peek() == &token {
            self.advance();
            Ok(())
        } else {
            Err(self.error(message))
        }
    }
    
    fn error(&self, message: &str) -> GraphQLError {
        GraphQLError::new(format!("Parse error: {}", message))
            .with_location(self.current_pos.line, self.current_pos.column)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_parse_simple_query() {
        let lexer = Lexer::new("{ hello }");
        let mut parser = Parser::new(lexer).unwrap();
        let document = parser.parse().unwrap();
        
        assert_eq!(document.definitions.len(), 1);
        
        if let Definition::Operation(op) = &document.definitions[0] {
            assert_eq!(op.operation_type, OperationType::Query);
            assert_eq!(op.name, None);
            assert_eq!(op.selection_set.selections.len(), 1);
            
            if let Selection::Field(field) = &op.selection_set.selections[0] {
                assert_eq!(field.name, "hello");
                assert_eq!(field.alias, None);
                assert_eq!(field.arguments.len(), 0);
                assert_eq!(field.selection_set, None);
            } else {
                panic!("Expected field selection");
            }
        } else {
            panic!("Expected operation definition");
        }
    }
    
    #[test]
    fn test_parse_query_with_alias() {
        let lexer = Lexer::new("{ greeting: hello }");
        let mut parser = Parser::new(lexer).unwrap();
        let document = parser.parse().unwrap();
        
        assert_eq!(document.definitions.len(), 1);
        
        if let Definition::Operation(op) = &document.definitions[0] {
            if let Selection::Field(field) = &op.selection_set.selections[0] {
                assert_eq!(field.name, "hello");
                assert_eq!(field.alias, Some("greeting".to_string()));
            } else {
                panic!("Expected field selection");
            }
        } else {
            panic!("Expected operation definition");
        }
    }
    
    #[test]
    fn test_parse_query_with_arguments() {
        let lexer = Lexer::new("{ user(id: 123) { name } }");
        let mut parser = Parser::new(lexer).unwrap();
        let document = parser.parse().unwrap();
        
        assert_eq!(document.definitions.len(), 1);
        
        if let Definition::Operation(op) = &document.definitions[0] {
            if let Selection::Field(field) = &op.selection_set.selections[0] {
                assert_eq!(field.name, "user");
                assert_eq!(field.arguments.len(), 1);
                assert_eq!(field.arguments[0].name, "id");
                
                if let Value::IntValue(123) = field.arguments[0].value {
                    // Success
                } else {
                    panic!("Expected int value 123");
                }
            } else {
                panic!("Expected field selection");
            }
        } else {
            panic!("Expected operation definition");
        }
    }
    
    #[test]
    fn test_parse_named_query() {
        let lexer = Lexer::new("query GetUser { user { name } }");
        let mut parser = Parser::new(lexer).unwrap();
        let document = parser.parse().unwrap();
        
        assert_eq!(document.definitions.len(), 1);
        
        if let Definition::Operation(op) = &document.definitions[0] {
            assert_eq!(op.operation_type, OperationType::Query);
            assert_eq!(op.name, Some("GetUser".to_string()));
        } else {
            panic!("Expected operation definition");
        }
    }
    
    #[test]
    fn test_parse_query_with_variables() {
        let lexer = Lexer::new("query GetUser($id: ID!) { user(id: $id) { name } }");
        let mut parser = Parser::new(lexer).unwrap();
        let document = parser.parse().unwrap();
        
        assert_eq!(document.definitions.len(), 1);
        
        if let Definition::Operation(op) = &document.definitions[0] {
            assert_eq!(op.variable_definitions.len(), 1);
            assert_eq!(op.variable_definitions[0].variable.name, "id");
            
            if let Type::NonNull(inner) = &op.variable_definitions[0].type_ {
                if let Type::Named(name) = inner.as_ref() {
                    assert_eq!(name, "ID");
                } else {
                    panic!("Expected named type");
                }
            } else {
                panic!("Expected non-null type");
            }
        } else {
            panic!("Expected operation definition");
        }
    }
    
    #[test]
    fn test_parse_mutation() {
        let lexer = Lexer::new("mutation CreateUser($input: UserInput!) { createUser(input: $input) { id name } }");
        let mut parser = Parser::new(lexer).unwrap();
        let document = parser.parse().unwrap();
        
        assert_eq!(document.definitions.len(), 1);
        
        if let Definition::Operation(op) = &document.definitions[0] {
            assert_eq!(op.operation_type, OperationType::Mutation);
            assert_eq!(op.name, Some("CreateUser".to_string()));
        } else {
            panic!("Expected operation definition");
        }
    }
    
    #[test]
    fn test_parse_fragment_definition() {
        let lexer = Lexer::new("fragment UserFragment on User { id name email }");
        let mut parser = Parser::new(lexer).unwrap();
        let document = parser.parse().unwrap();
        
        assert_eq!(document.definitions.len(), 1);
        
        if let Definition::Fragment(fragment) = &document.definitions[0] {
            assert_eq!(fragment.name, "UserFragment");
            assert_eq!(fragment.type_condition, "User");
            assert_eq!(fragment.selection_set.selections.len(), 3);
        } else {
            panic!("Expected fragment definition");
        }
    }
    
    #[test]
    fn test_parse_query_with_fragment_spread() {
        let lexer = Lexer::new("{ user { ...UserFragment } }");
        let mut parser = Parser::new(lexer).unwrap();
        let document = parser.parse().unwrap();
        
        assert_eq!(document.definitions.len(), 1);
        
        if let Definition::Operation(op) = &document.definitions[0] {
            if let Selection::Field(field) = &op.selection_set.selections[0] {
                assert_eq!(field.name, "user");
                if let Some(selection_set) = &field.selection_set {
                    if let Selection::FragmentSpread(spread) = &selection_set.selections[0] {
                        assert_eq!(spread.fragment_name, "UserFragment");
                    } else {
                        panic!("Expected fragment spread");
                    }
                }
            } else {
                panic!("Expected field");
            }
        } else {
            panic!("Expected operation");
        }
    }
    
    #[test]
    fn test_parse_query_with_inline_fragment() {
        let lexer = Lexer::new("{ search { ... on User { name } } }");
        let mut parser = Parser::new(lexer).unwrap();
        let document = parser.parse().unwrap();
        
        assert_eq!(document.definitions.len(), 1);
        
        if let Definition::Operation(op) = &document.definitions[0] {
            if let Selection::Field(field) = &op.selection_set.selections[0] {
                assert_eq!(field.name, "search");
                if let Some(selection_set) = &field.selection_set {
                    if let Selection::InlineFragment(inline) = &selection_set.selections[0] {
                        assert_eq!(inline.type_condition, Some("User".to_string()));
                        assert_eq!(inline.selection_set.selections.len(), 1);
                    } else {
                        panic!("Expected inline fragment");
                    }
                }
            } else {
                panic!("Expected field");
            }
        } else {
            panic!("Expected operation");
        }
    }
    
    #[test]
    fn test_parse_query_with_directives() {
        let lexer = Lexer::new("{ user @include(if: $shouldInclude) { name } }");
        let mut parser = Parser::new(lexer).unwrap();
        let document = parser.parse().unwrap();
        
        assert_eq!(document.definitions.len(), 1);
        
        if let Definition::Operation(op) = &document.definitions[0] {
            if let Selection::Field(field) = &op.selection_set.selections[0] {
                assert_eq!(field.name, "user");
                assert_eq!(field.directives.len(), 1);
                assert_eq!(field.directives[0].name, "include");
                assert_eq!(field.directives[0].arguments.len(), 1);
                assert_eq!(field.directives[0].arguments[0].name, "if");
            } else {
                panic!("Expected field");
            }
        } else {
            panic!("Expected operation");
        }
    }
    
    #[test]
    fn test_parse_query_with_list_types() {
        let lexer = Lexer::new("query GetUsers($ids: [ID!]!) { users(ids: $ids) { name } }");
        let mut parser = Parser::new(lexer).unwrap();
        let document = parser.parse().unwrap();
        
        assert_eq!(document.definitions.len(), 1);
        
        if let Definition::Operation(op) = &document.definitions[0] {
            assert_eq!(op.variable_definitions.len(), 1);
            
            if let Type::NonNull(outer) = &op.variable_definitions[0].type_ {
                if let Type::List(inner) = outer.as_ref() {
                    if let Type::NonNull(element) = inner.as_ref() {
                        if let Type::Named(name) = element.as_ref() {
                            assert_eq!(name, "ID");
                        } else {
                            panic!("Expected named type");
                        }
                    } else {
                        panic!("Expected non-null element type");
                    }
                } else {
                    panic!("Expected list type");
                }
            } else {
                panic!("Expected non-null type");
            }
        } else {
            panic!("Expected operation");
        }
    }
    
    #[test]
    fn test_parse_query_with_complex_values() {
        let lexer = Lexer::new(r#"{ search(filters: {name: "John", age: 30, active: true, tags: ["dev", "rust"]}) { id } }"#);
        let mut parser = Parser::new(lexer).unwrap();
        let document = parser.parse().unwrap();
        
        assert_eq!(document.definitions.len(), 1);
        
        if let Definition::Operation(op) = &document.definitions[0] {
            if let Selection::Field(field) = &op.selection_set.selections[0] {
                assert_eq!(field.name, "search");
                assert_eq!(field.arguments.len(), 1);
                assert_eq!(field.arguments[0].name, "filters");
                
                if let Value::ObjectValue(obj) = &field.arguments[0].value {
                    assert!(obj.contains_key("name"));
                    assert!(obj.contains_key("age"));
                    assert!(obj.contains_key("active"));
                    assert!(obj.contains_key("tags"));
                } else {
                    panic!("Expected object value");
                }
            } else {
                panic!("Expected field");
            }
        } else {
            panic!("Expected operation");
        }
    }
}