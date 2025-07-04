use crate::graphql::GraphQLError;
use std::fmt;

#[derive(Debug, Clone, PartialEq)]
pub enum Token {
    // Punctuation
    LeftBrace,    // {
    RightBrace,   // }
    LeftParen,    // (
    RightParen,   // )
    LeftBracket,  // [
    RightBracket, // ]
    Colon,        // :
    Semicolon,    // ;
    Comma,        // ,
    Pipe,         // |
    Ampersand,    // &
    Equals,       // =
    At,           // @
    Ellipsis,     // ...
    Exclamation,  // !
    Dollar,       // $
    
    // Literals
    Name(String),
    IntValue(i64),
    FloatValue(f64),
    StringValue(String),
    
    // Keywords
    Query,
    Mutation,
    Subscription,
    Fragment,
    On,
    True,
    False,
    Null,
    
    // Special
    EndOfFile,
}

impl fmt::Display for Token {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Token::LeftBrace => write!(f, "{{"),
            Token::RightBrace => write!(f, "}}"),
            Token::LeftParen => write!(f, "("),
            Token::RightParen => write!(f, ")"),
            Token::LeftBracket => write!(f, "["),
            Token::RightBracket => write!(f, "]"),
            Token::Colon => write!(f, ":"),
            Token::Semicolon => write!(f, ";"),
            Token::Comma => write!(f, ","),
            Token::Pipe => write!(f, "|"),
            Token::Ampersand => write!(f, "&"),
            Token::Equals => write!(f, "="),
            Token::At => write!(f, "@"),
            Token::Ellipsis => write!(f, "..."),
            Token::Exclamation => write!(f, "!"),
            Token::Dollar => write!(f, "$"),
            Token::Name(name) => write!(f, "{}", name),
            Token::IntValue(value) => write!(f, "{}", value),
            Token::FloatValue(value) => write!(f, "{}", value),
            Token::StringValue(value) => write!(f, "\"{}\"", value),
            Token::Query => write!(f, "query"),
            Token::Mutation => write!(f, "mutation"),
            Token::Subscription => write!(f, "subscription"),
            Token::Fragment => write!(f, "fragment"),
            Token::On => write!(f, "on"),
            Token::True => write!(f, "true"),
            Token::False => write!(f, "false"),
            Token::Null => write!(f, "null"),
            Token::EndOfFile => write!(f, "EOF"),
        }
    }
}

#[derive(Debug, Clone, PartialEq)]
pub struct Position {
    pub line: u32,
    pub column: u32,
    pub offset: usize,
}

impl Position {
    pub fn new() -> Self {
        Self {
            line: 1,
            column: 1,
            offset: 0,
        }
    }
    
    pub fn advance(&mut self, ch: char) {
        if ch == '\n' {
            self.line += 1;
            self.column = 1;
        } else {
            self.column += 1;
        }
        self.offset += ch.len_utf8();
    }
}

pub struct Lexer {
    input: Vec<char>,
    position: usize,
    current_pos: Position,
}

impl Lexer {
    pub fn new(input: &str) -> Self {
        Self {
            input: input.chars().collect(),
            position: 0,
            current_pos: Position::new(),
        }
    }
    
    pub fn tokenize(&mut self) -> Result<Vec<Token>, GraphQLError> {
        let mut tokens = Vec::new();
        
        loop {
            let token = self.next_token()?;
            if token == Token::EndOfFile {
                tokens.push(token);
                break;
            }
            tokens.push(token);
        }
        
        Ok(tokens)
    }
    
    pub fn next_token(&mut self) -> Result<Token, GraphQLError> {
        self.skip_whitespace_and_comments();
        
        if self.position >= self.input.len() {
            return Ok(Token::EndOfFile);
        }
        
        let ch = self.current_char();
        
        match ch {
            '{' => {
                self.advance();
                Ok(Token::LeftBrace)
            }
            '}' => {
                self.advance();
                Ok(Token::RightBrace)
            }
            '(' => {
                self.advance();
                Ok(Token::LeftParen)
            }
            ')' => {
                self.advance();
                Ok(Token::RightParen)
            }
            '[' => {
                self.advance();
                Ok(Token::LeftBracket)
            }
            ']' => {
                self.advance();
                Ok(Token::RightBracket)
            }
            ':' => {
                self.advance();
                Ok(Token::Colon)
            }
            ';' => {
                self.advance();
                Ok(Token::Semicolon)
            }
            ',' => {
                self.advance();
                Ok(Token::Comma)
            }
            '|' => {
                self.advance();
                Ok(Token::Pipe)
            }
            '&' => {
                self.advance();
                Ok(Token::Ampersand)
            }
            '=' => {
                self.advance();
                Ok(Token::Equals)
            }
            '@' => {
                self.advance();
                Ok(Token::At)
            }
            '!' => {
                self.advance();
                Ok(Token::Exclamation)
            }
            '$' => {
                self.advance();
                Ok(Token::Dollar)
            }
            '.' => {
                if self.peek_char() == Some('.') && self.peek_char_at(2) == Some('.') {
                    self.advance();
                    self.advance();
                    self.advance();
                    Ok(Token::Ellipsis)
                } else {
                    Err(GraphQLError::new("Unexpected character '.'")
                        .with_location(self.current_pos.line, self.current_pos.column))
                }
            }
            '"' => self.read_string(),
            ch if ch.is_ascii_digit() || ch == '-' => self.read_number(),
            ch if ch.is_alphabetic() || ch == '_' => self.read_name(),
            _ => Err(GraphQLError::new(format!("Unexpected character '{}'", ch))
                .with_location(self.current_pos.line, self.current_pos.column)),
        }
    }
    
    fn current_char(&self) -> char {
        self.input[self.position]
    }
    
    fn peek_char(&self) -> Option<char> {
        self.input.get(self.position + 1).copied()
    }
    
    fn peek_char_at(&self, offset: usize) -> Option<char> {
        self.input.get(self.position + offset).copied()
    }
    
    fn advance(&mut self) {
        if self.position < self.input.len() {
            self.current_pos.advance(self.input[self.position]);
            self.position += 1;
        }
    }
    
    fn skip_whitespace_and_comments(&mut self) {
        while self.position < self.input.len() {
            let ch = self.current_char();
            
            if ch.is_whitespace() {
                self.advance();
            } else if ch == '#' {
                // Skip comment line
                while self.position < self.input.len() && self.current_char() != '\n' {
                    self.advance();
                }
            } else {
                break;
            }
        }
    }
    
    fn read_string(&mut self) -> Result<Token, GraphQLError> {
        let start_pos = self.current_pos.clone();
        self.advance(); // Skip opening quote
        
        let mut value = String::new();
        let mut escaped = false;
        
        while self.position < self.input.len() {
            let ch = self.current_char();
            
            if escaped {
                match ch {
                    '"' => value.push('"'),
                    '\\' => value.push('\\'),
                    '/' => value.push('/'),
                    'b' => value.push('\u{0008}'),
                    'f' => value.push('\u{000C}'),
                    'n' => value.push('\n'),
                    'r' => value.push('\r'),
                    't' => value.push('\t'),
                    'u' => {
                        // Unicode escape sequence
                        let mut hex = String::new();
                        for _ in 0..4 {
                            self.advance();
                            if self.position >= self.input.len() {
                                return Err(GraphQLError::new("Unterminated string literal")
                                    .with_location(start_pos.line, start_pos.column));
                            }
                            hex.push(self.current_char());
                        }
                        
                        if let Ok(code_point) = u32::from_str_radix(&hex, 16) {
                            if let Some(unicode_char) = char::from_u32(code_point) {
                                value.push(unicode_char);
                            } else {
                                return Err(GraphQLError::new("Invalid unicode escape sequence")
                                    .with_location(start_pos.line, start_pos.column));
                            }
                        } else {
                            return Err(GraphQLError::new("Invalid unicode escape sequence")
                                .with_location(start_pos.line, start_pos.column));
                        }
                    }
                    _ => {
                        return Err(GraphQLError::new(format!("Invalid escape sequence '\\{}'", ch))
                            .with_location(start_pos.line, start_pos.column));
                    }
                }
                escaped = false;
            } else if ch == '\\' {
                escaped = true;
            } else if ch == '"' {
                self.advance(); // Skip closing quote
                return Ok(Token::StringValue(value));
            } else if ch == '\n' || ch == '\r' {
                return Err(GraphQLError::new("Unterminated string literal")
                    .with_location(start_pos.line, start_pos.column));
            } else {
                value.push(ch);
            }
            
            self.advance();
        }
        
        Err(GraphQLError::new("Unterminated string literal")
            .with_location(start_pos.line, start_pos.column))
    }
    
    fn read_number(&mut self) -> Result<Token, GraphQLError> {
        let start_pos = self.current_pos.clone();
        let mut value = String::new();
        let mut is_float = false;
        
        // Handle negative sign
        if self.current_char() == '-' {
            value.push(self.current_char());
            self.advance();
        }
        
        // Read integer part
        if self.position >= self.input.len() || !self.current_char().is_ascii_digit() {
            return Err(GraphQLError::new("Invalid number")
                .with_location(start_pos.line, start_pos.column));
        }
        
        while self.position < self.input.len() && self.current_char().is_ascii_digit() {
            value.push(self.current_char());
            self.advance();
        }
        
        // Check for decimal point
        if self.position < self.input.len() && self.current_char() == '.' {
            is_float = true;
            value.push(self.current_char());
            self.advance();
            
            // Read fractional part
            if self.position >= self.input.len() || !self.current_char().is_ascii_digit() {
                return Err(GraphQLError::new("Invalid number")
                    .with_location(start_pos.line, start_pos.column));
            }
            
            while self.position < self.input.len() && self.current_char().is_ascii_digit() {
                value.push(self.current_char());
                self.advance();
            }
        }
        
        // Check for exponent
        if self.position < self.input.len() && (self.current_char() == 'e' || self.current_char() == 'E') {
            is_float = true;
            value.push(self.current_char());
            self.advance();
            
            // Optional sign
            if self.position < self.input.len() && (self.current_char() == '+' || self.current_char() == '-') {
                value.push(self.current_char());
                self.advance();
            }
            
            // Read exponent digits
            if self.position >= self.input.len() || !self.current_char().is_ascii_digit() {
                return Err(GraphQLError::new("Invalid number")
                    .with_location(start_pos.line, start_pos.column));
            }
            
            while self.position < self.input.len() && self.current_char().is_ascii_digit() {
                value.push(self.current_char());
                self.advance();
            }
        }
        
        if is_float {
            match value.parse::<f64>() {
                Ok(f) => Ok(Token::FloatValue(f)),
                Err(_) => Err(GraphQLError::new("Invalid number")
                    .with_location(start_pos.line, start_pos.column)),
            }
        } else {
            match value.parse::<i64>() {
                Ok(i) => Ok(Token::IntValue(i)),
                Err(_) => Err(GraphQLError::new("Invalid number")
                    .with_location(start_pos.line, start_pos.column)),
            }
        }
    }
    
    fn read_name(&mut self) -> Result<Token, GraphQLError> {
        let mut value = String::new();
        
        while self.position < self.input.len() {
            let ch = self.current_char();
            if ch.is_alphanumeric() || ch == '_' {
                value.push(ch);
                self.advance();
            } else {
                break;
            }
        }
        
        // Check if it's a keyword
        let token = match value.as_str() {
            "query" => Token::Query,
            "mutation" => Token::Mutation,
            "subscription" => Token::Subscription,
            "fragment" => Token::Fragment,
            "on" => Token::On,
            "true" => Token::True,
            "false" => Token::False,
            "null" => Token::Null,
            _ => Token::Name(value),
        };
        
        Ok(token)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_tokenize_simple_query() {
        let mut lexer = Lexer::new("{ hello }");
        let tokens = lexer.tokenize().unwrap();
        
        assert_eq!(tokens, vec![
            Token::LeftBrace,
            Token::Name("hello".to_string()),
            Token::RightBrace,
            Token::EndOfFile,
        ]);
    }
    
    #[test]
    fn test_tokenize_query_with_field() {
        let mut lexer = Lexer::new("query { user { name } }");
        let tokens = lexer.tokenize().unwrap();
        
        assert_eq!(tokens, vec![
            Token::Query,
            Token::LeftBrace,
            Token::Name("user".to_string()),
            Token::LeftBrace,
            Token::Name("name".to_string()),
            Token::RightBrace,
            Token::RightBrace,
            Token::EndOfFile,
        ]);
    }
    
    #[test]
    fn test_tokenize_string_literal() {
        let mut lexer = Lexer::new(r#""hello world""#);
        let tokens = lexer.tokenize().unwrap();
        
        assert_eq!(tokens, vec![
            Token::StringValue("hello world".to_string()),
            Token::EndOfFile,
        ]);
    }
    
    #[test]
    fn test_tokenize_integer() {
        let mut lexer = Lexer::new("123");
        let tokens = lexer.tokenize().unwrap();
        
        assert_eq!(tokens, vec![
            Token::IntValue(123),
            Token::EndOfFile,
        ]);
    }
    
    #[test]
    fn test_tokenize_float() {
        let mut lexer = Lexer::new("123.45");
        let tokens = lexer.tokenize().unwrap();
        
        assert_eq!(tokens, vec![
            Token::FloatValue(123.45),
            Token::EndOfFile,
        ]);
    }
    
    #[test]
    fn test_tokenize_with_comments() {
        let mut lexer = Lexer::new("{ # This is a comment\n  hello }");
        let tokens = lexer.tokenize().unwrap();
        
        assert_eq!(tokens, vec![
            Token::LeftBrace,
            Token::Name("hello".to_string()),
            Token::RightBrace,
            Token::EndOfFile,
        ]);
    }
    
    #[test]
    fn test_tokenize_variables() {
        let mut lexer = Lexer::new("query GetUser($id: ID!) { user(id: $id) }");
        let tokens = lexer.tokenize().unwrap();
        
        assert_eq!(tokens, vec![
            Token::Query,
            Token::Name("GetUser".to_string()),
            Token::LeftParen,
            Token::Dollar,
            Token::Name("id".to_string()),
            Token::Colon,
            Token::Name("ID".to_string()),
            Token::Exclamation,
            Token::RightParen,
            Token::LeftBrace,
            Token::Name("user".to_string()),
            Token::LeftParen,
            Token::Name("id".to_string()),
            Token::Colon,
            Token::Dollar,
            Token::Name("id".to_string()),
            Token::RightParen,
            Token::RightBrace,
            Token::EndOfFile,
        ]);
    }
    
    #[test]
    fn test_error_on_invalid_character() {
        let mut lexer = Lexer::new("{ hello % }");
        let result = lexer.tokenize();
        
        assert!(result.is_err());
        assert!(result.unwrap_err().message.contains("Unexpected character"));
    }
    
    #[test]
    fn test_error_on_unterminated_string() {
        let mut lexer = Lexer::new(r#""hello"#);
        let result = lexer.tokenize();
        
        assert!(result.is_err());
        assert!(result.unwrap_err().message.contains("Unterminated string literal"));
    }
}