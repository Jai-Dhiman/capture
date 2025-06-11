# Capture - Passwordless Authentication System

## Overview

Capture uses a modern passwordless authentication system built on Cloudflare Workers, providing secure, scalable, and user-friendly authentication through email verification codes.

### Key Features
- 🔐 **Passwordless**: No passwords to remember or manage
- 📧 **Email-based**: Secure 6-digit verification codes sent via email
- 🔄 **Unified Flow**: Login and registration are the same process
- 🚀 **Fast**: Optimized for mobile and web applications
- 🛡️ **Secure**: Enterprise-grade security with JWT tokens and refresh token rotation
- 📱 **Mobile-first**: Designed for React Native with web support

## Architecture

### Tech Stack
- **Runtime**: Cloudflare Workers
- **Database**: Cloudflare D1 (SQLite)
- **Key-Value Store**: Cloudflare KV (for refresh tokens and rate limiting)
- **Email Service**: Resend API
- **Authentication**: JWT tokens with refresh token rotation
- **Rate Limiting**: Multi-layer protection against abuse

### Database Schema

#### Users Table
```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  email_verified INTEGER DEFAULT 0,
  phone TEXT,
  phone_verified INTEGER DEFAULT 0,
  created_at NUMERIC DEFAULT (datetime('now')),
  updated_at NUMERIC DEFAULT (datetime('now'))
);
```

#### Email Codes Table
```sql
CREATE TABLE email_codes (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  code TEXT NOT NULL,
  type TEXT NOT NULL, -- 'login_register' or 'verification'
  expires_at NUMERIC NOT NULL,
  created_at NUMERIC DEFAULT (datetime('now')),
  used_at NUMERIC, -- null until used
  -- Indexes for performance
  INDEX idx_email_codes_email (email),
  INDEX idx_email_codes_expires (expires_at),
  INDEX idx_email_codes_code (code)
);
```

## Authentication Flow

### 1. User Registration/Login (Unified)
1. User enters email address
2. System generates secure 6-digit code
3. Code stored in database with 10-minute expiry
4. Beautiful HTML email sent via Resend
5. User enters code in app
6. System verifies code and creates/authenticates user
7. JWT tokens returned to client
8. User authenticated and ready to use app

### 2. Session Management
- **Access Token**: 15-minute expiry, used for API requests
- **Refresh Token**: 7-day expiry, stored securely, rotated on each use
- **Automatic Refresh**: Client automatically refreshes tokens when needed

### 3. Security Features
- **Code Expiration**: 10-minute lifetime for verification codes
- **Single-use Codes**: Codes become invalid after verification
- **Rate Limiting**: Protection against brute force and spam
- **Secure Generation**: Cryptographically random codes
- **Token Rotation**: Refresh tokens are invalidated and replaced on each use

## API Endpoints

### Authentication Endpoints

#### Send Verification Code
```http
POST /auth/send-code
Content-Type: application/json

{
  "email": "user@example.com",
  "phone": "+1234567890" // Optional, for registration
}
```

**Response:**
```json
{
  "success": true,
  "message": "Welcome! We've sent a verification code to your email.",
  "isNewUser": true
}
```

#### Verify Code & Authenticate
```http
POST /auth/verify-code
Content-Type: application/json

{
  "email": "user@example.com",
  "code": "123456",
  "phone": "+1234567890" // Optional, for registration
}
```

**Response:**
```json
{
  "session": {
    "access_token": "eyJhbGciOiJIUzI1NiIs...",
    "refresh_token": "abc123def456...",
    "expires_at": 1640995200000
  },
  "user": {
    "id": "user_123",
    "email": "user@example.com"
  },
  "profileExists": false,
  "isNewUser": true
}
```

#### Refresh Session
```http
POST /auth/refresh
Content-Type: application/json

{
  "refresh_token": "abc123def456..."
}
```

**Response:**
```json
{
  "session": {
    "access_token": "eyJhbGciOiJIUzI1NiIs...",
    "refresh_token": "new_refresh_token...",
    "expires_at": 1640995200000
  },
  "user": {
    "id": "user_123",
    "email": "user@example.com"
  },
  "profileExists": true
}
```

#### Logout
```http
POST /auth/logout
Content-Type: application/json

{
  "refresh_token": "abc123def456..." // Optional
}
```

**Response:**
```json
{
  "success": true,
  "message": "Logged out successfully."
}
```

#### Get Current User
```http
GET /auth/me
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

**Response:**
```json
{
  "id": "user_123",
  "email": "user@example.com",
  "profileExists": true
}
```

### Error Responses

All endpoints return standardized error responses:

```json
{
  "error": "Error message",
  "code": "auth/error-code"
}
```

Common error codes:
- `auth/invalid-input` - Invalid request data
- `auth/invalid-code` - Invalid or expired verification code
- `auth/code-expired` - Verification code has expired
- `auth/email-send-failed` - Failed to send verification email
- `auth/invalid-refresh-token` - Invalid or expired refresh token
- `auth/user-not-found` - User not found
- `auth/server-error` - Internal server error

## Testing with Postman

### Environment Setup

Create a Postman environment with these variables:
- `BASE_URL`: `http://localhost:8787` (development) or `https://your-worker.workers.dev` (production)
- `ACCESS_TOKEN`: (will be set automatically)
- `REFRESH_TOKEN`: (will be set automatically)

### Test Collection

#### 1. Health Check
```http
GET {{BASE_URL}}/
```

#### 2. Complete Auth Flow Test

**Step 1: Send Code**
```http
POST {{BASE_URL}}/auth/send-code
Content-Type: application/json

{
  "email": "test@example.com"
}
```

**Step 2: Verify Code**
```http
POST {{BASE_URL}}/auth/verify-code
Content-Type: application/json

{
  "email": "test@example.com",
  "code": "123456"
}
```

**Post-response Script:**
```javascript
if (pm.response.code === 200) {
  const response = pm.response.json();
  pm.environment.set("ACCESS_TOKEN", response.session.access_token);
  pm.environment.set("REFRESH_TOKEN", response.session.refresh_token);
}
```

#### 3. Protected Endpoint Test
```http
GET {{BASE_URL}}/auth/me
Authorization: Bearer {{ACCESS_TOKEN}}
```

#### 4. Token Refresh Test
```http
POST {{BASE_URL}}/auth/refresh
Content-Type: application/json

{
  "refresh_token": "{{REFRESH_TOKEN}}"
}
```

#### 5. Logout Test
```http
POST {{BASE_URL}}/auth/logout
Content-Type: application/json

{
  "refresh_token": "{{REFRESH_TOKEN}}"
}
```

### Development Testing (Local)

For local testing without email sending, use the test endpoint:

```http
POST {{BASE_URL}}/auth/send-code-test
Content-Type: application/json

{
  "email": "test@example.com"
}
```

This will return the verification code in the response for testing.

### Complete Flow Test Endpoint

For testing the entire authentication flow in one request:

```http
POST {{BASE_URL}}/auth/test-complete-flow
```

This endpoint:
1. Creates a test user with email `flow@test.com`
2. Generates code `999888`
3. Stores code in database
4. Immediately verifies the code
5. Marks code as used
6. Returns success confirmation

## Frontend Integration

### React Native Implementation

The authentication system is fully integrated with React Native using:

#### API Client (`workersAuthApi.ts`)
```typescript
import { workersAuthApi } from '@/features/auth/lib/workersAuthApi';

// Send verification code
const response = await workersAuthApi.sendCode({ email: 'user@example.com' });

// Verify code
const authResponse = await workersAuthApi.verifyCode({ 
  email: 'user@example.com', 
  code: '123456' 
});
```

#### React Hooks (`useAuth.ts`)
```typescript
import { useAuth } from '@/features/auth/hooks/useAuth';

function LoginScreen() {
  const { sendCode, verifyCode } = useAuth();
  
  const handleSendCode = async () => {
    await sendCode.mutateAsync({ email });
  };
  
  const handleVerifyCode = async () => {
    await verifyCode.mutateAsync({ email, code });
  };
}
```

#### State Management (`authStore.ts`)
```typescript
import { useAuthStore } from '@/features/auth/stores/authStore';

function App() {
  const { user, session, stage } = useAuthStore();
  
  // stage can be: 'unauthenticated', 'profileRequired', 'authenticated'
}
```

### Authentication States

- `unauthenticated`: User not logged in
- `profileRequired`: User authenticated but needs to complete profile
- `authenticated`: User fully authenticated and ready

## Deployment

### Environment Variables

Required environment variables for Cloudflare Workers:

```toml
# wrangler.toml
[vars]
ENV = "production"

# Secrets (set via wrangler or dashboard)
JWT_SECRET = "your-256-bit-secret"
RESEND_API_KEY = "re_your_resend_api_key"
```

### KV Namespaces

```toml
# wrangler.toml
[[kv_namespaces]]
binding = "REFRESH_TOKEN_KV"
id = "your_kv_namespace_id"

[[kv_namespaces]]
binding = "Capture_Rate_Limits"
id = "your_rate_limit_kv_id"
```

### D1 Database

```toml
# wrangler.toml
[[d1_databases]]
binding = "DB"
database_name = "capture-db"
database_id = "your_database_id"
migrations_dir = "drizzle"
```

### Deployment Commands

```bash
# Deploy to production
cd apps/server
npm run deploy

# Apply database migrations
npx wrangler d1 migrations apply capture-db
```

## Security Considerations

### Production Checklist

- [ ] Remove test endpoints (`/auth/send-code-test`, `/auth/debug-db-test`, `/auth/test-complete-flow`)
- [ ] Configure proper CORS origins
- [ ] Set up monitoring and logging
- [ ] Configure rate limiting thresholds
- [ ] Set up email domain verification
- [ ] Enable HTTPS only
- [ ] Review JWT secret strength
- [ ] Set up backup and recovery procedures

### Rate Limiting

- **OTP Requests**: 5 per 10 minutes per IP
- **Authentication**: 30 per 15 minutes per IP
- **Global**: Configurable per endpoint

### Security Headers

The system automatically includes security headers:
- `X-RateLimit-Limit`
- `X-RateLimit-Remaining`
- `X-RateLimit-Reset`
- `Retry-After` (when rate limited)

## Monitoring and Logging

### Key Metrics to Monitor

- Authentication success rate
- Email delivery rate
- Token refresh rate
- Rate limit hits
- Error rates by endpoint

### Log Formats

All authentication events are logged with structured data:
```json
{
  "timestamp": "2025-06-10T04:13:40.890Z",
  "level": "info",
  "event": "auth/login_success",
  "user_id": "user_123",
  "email": "user@example.com",
  "is_new_user": true
}
```

## Future Enhancements

### Planned Features

1. **Passkey Support**: WebAuthn integration for even faster authentication
2. **SMS Backup**: Phone number verification as fallback
3. **Magic Links**: Email-based one-click authentication
4. **Trusted Devices**: Remember devices for faster auth
5. **Multi-factor**: Additional security layers when needed

### Database Schema Ready

The system is already prepared for passkey integration:

```sql
CREATE TABLE passkeys (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  credential_id TEXT NOT NULL UNIQUE,
  public_key TEXT NOT NULL,
  counter INTEGER DEFAULT 0,
  device_name TEXT,
  created_at NUMERIC DEFAULT (datetime('now')),
  last_used_at NUMERIC
);
```

---

## Support

For technical issues or questions about the authentication system:

1. Check the error codes and messages
2. Review the logs for detailed error information
3. Test with the provided Postman collection
4. Verify environment configuration

The authentication system is designed to be robust, secure, and user-friendly while maintaining high performance and scalability. 