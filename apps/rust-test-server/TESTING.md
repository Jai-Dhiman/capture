# 🧪 Authentication Testing Guide

This guide covers comprehensive testing of all authentication routes in the Rust test server.

## 🚀 Quick Start

### Prerequisites
- `curl` command available
- `jq` for JSON parsing
- `bc` for calculations (performance tests)
- Server running on `http://127.0.0.1:8787`

### Make Scripts Executable
```bash
chmod +x test_auth.sh test_auth_errors.sh test_auth_performance.sh
```

## 📋 Test Suites

### 1. Happy Path Flow Test (`test_auth.sh`)
Tests the complete authentication flow with valid inputs:

```bash
./test_auth.sh
```

**What it tests:**
- ✅ Health check
- ✅ Send verification code
- ✅ Verify code and get tokens
- ✅ Get authenticated user info
- ✅ Refresh access token
- ✅ Use new access token

**Interactive:** Requires you to enter the verification code from server logs.

### 2. Error Cases Test (`test_auth_errors.sh`)
Tests error handling and edge cases:

```bash
./test_auth_errors.sh
```

**What it tests:**
- ❌ Invalid email formats
- ❌ Missing required fields
- ❌ Invalid JSON payloads
- ❌ Wrong verification codes
- ❌ Missing authorization headers
- ❌ Invalid token formats
- ❌ Malformed requests

### 3. Performance Benchmark (`test_auth_performance.sh`)
Measures response times and throughput:

```bash
./test_auth_performance.sh
```

**What it measures:**
- ⚡ Response times (avg, min, max)
- ⚡ Requests per second
- ⚡ Concurrent request handling
- ⚡ Database query performance
- ⚡ Error handling performance

## 📊 Performance Comparison

### Rust vs TypeScript Testing

1. **Start your Rust server:**
   ```bash
   wrangler dev --local
   ```

2. **Run performance tests:**
   ```bash
   ./test_auth_performance.sh > rust_results.txt
   ```

3. **Start your TypeScript server:**
   ```bash
   cd ../server && npm run dev
   ```

4. **Modify the BASE_URL in scripts and run again:**
   ```bash
   # Edit scripts to use TypeScript server URL
   sed -i 's|127.0.0.1:8787|localhost:3000|g' test_auth_performance.sh
   ./test_auth_performance.sh > typescript_results.txt
   ```

5. **Compare results:**
   ```bash
   diff rust_results.txt typescript_results.txt
   ```

## 🔍 Key Metrics to Monitor

### Response Times
- **Health check:** Baseline performance
- **Send code:** Database write + email simulation
- **Verify code:** Database read/write + token generation
- **Get user info:** Database read + auth validation
- **Refresh token:** KV store operations

### Database Performance
- **Insert operations:** User creation, code storage
- **Query operations:** User lookup, code validation
- **Update operations:** Code marking as used

### Error Handling
- **Validation speed:** Input validation performance
- **Error response time:** How quickly errors are returned

## 📝 Manual Testing

For manual testing with curl:

### Send Code
```bash
curl -X POST http://127.0.0.1:8787/auth/send-code \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com"}'
```

### Verify Code
```bash
curl -X POST http://127.0.0.1:8787/auth/verify-code \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "code": "123456"}'
```

### Get User Info
```bash
curl -X GET http://127.0.0.1:8787/auth/me \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### Refresh Token
```bash
curl -X POST http://127.0.0.1:8787/auth/refresh-token \
  -H "Content-Type: application/json" \
  -d '{"refresh_token": "YOUR_REFRESH_TOKEN_HERE"}'
```

## 🐛 Debugging Tips

### Check Server Logs
- Verification codes are logged to console during development
- Database errors appear in server logs
- Token validation errors are logged

### Common Issues
1. **Missing environment variables:** Check `.dev.vars` file
2. **Database not connected:** Verify D1 binding in `wrangler.toml`
3. **CORS issues:** Check if running in local mode
4. **Token parsing errors:** Verify token format and encoding

### Database Inspection
```bash
# If using local D1, you can inspect the database
wrangler d1 execute DB --local --command "SELECT * FROM users;"
wrangler d1 execute DB --local --command "SELECT * FROM email_codes;"
```

## 📈 Performance Optimization Areas

Based on test results, focus optimization on:

1. **Database queries:** Raw SQL vs ORM performance
2. **JSON serialization:** Rust serde vs JavaScript JSON
3. **Token operations:** Simple base64 vs JWT libraries
4. **Memory allocation:** Rust zero-copy vs JavaScript GC
5. **Cold start time:** WASM initialization vs V8 JIT

## ✅ Success Criteria

Your Rust implementation should:
- ✅ Pass all happy path tests
- ✅ Handle all error cases appropriately
- ✅ Match or exceed TypeScript performance
- ✅ Maintain data consistency
- ✅ Provide proper security validations

## 🚀 Next Steps

After authentication testing:
1. Convert more routes (posts, comments, etc.)
2. Add integration tests with frontend
3. Deploy to production and compare real-world performance
4. Implement proper JWT with WebAssembly-compatible libraries
5. Add rate limiting and security hardening 