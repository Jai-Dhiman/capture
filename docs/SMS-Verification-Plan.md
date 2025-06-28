# 📱 SMS Verification Implementation Plan
## **Plivo Verify API + Zod Validation**

---

## **🎯 Overview**

This plan outlines the complete implementation of SMS-based phone verification **during registration only**. The implementation will use:

- **Plivo Verify API**: Complete OTP verification system
- **Zod + libphonenumber-js**: Client-side phone validation and formatting
- **Registration-Only Flow**: Phone verification required for new users, existing users sign in with email/passkey/OAuth

**Key Decision**: Phone verification is **required during registration** but **not required for sign-in**. Existing users sign in with email/passkey/OAuth without phone re-verification.

---

## **📋 Implementation Phases**

### **Phase 1: Backend Foundation**
- SMS service integration with Plivo Verify API
- Registration-specific API endpoints
- Rate limiting & security

### **Phase 2: Frontend Integration**
- Update RegisterScreen with phone input
- Create PhoneVerificationScreen (similar to CodeVerificationScreen)
- Update registration flow: Register → Email Verification → Phone Verification → Create Profile
- Sign-in remains unchanged (email/passkey/OAuth only)

### **Phase 3: Testing & Optimization**
- Unit and integration tests
- Cost monitoring
- Performance optimization
- Security hardening

### **Phase 4: Production Deployment**
- Environment configuration
- Monitoring setup
- Documentation
- Launch preparation

---

## **🏗️ Architecture Overview**

### **Registration Flow (NEW)**
```
RegisterScreen (email + phone input)
    ↓
CodeVerificationScreen (verify email - existing)
    ↓  
PhoneVerificationScreen (verify phone with SMS - new)
    ↓
CreateProfile (existing)
```

### **Sign-in Flow (UNCHANGED)**
```
LoginScreen (email/passkey/OAuth)
    ↓
Authenticated (no phone verification required)
```

### **Data Flow**
1. **User enters email + phone** on RegisterScreen
2. **Email verification** happens first (existing flow)
3. **Zod + libphonenumber-js validates** phone format and country
4. **Plivo Verify API** generates, stores, and sends SMS OTP
5. **User enters SMS code** for verification
6. **Plivo validates** the OTP code
7. **System marks phone as verified** and continues to profile creation
8. **JWT tokens** generated for session

---

## **🗄️ Database Schema Changes - SIMPLIFIED**

### **Keep Existing Fields**
- `phone` TEXT (already exists)
- `phoneVerified` INTEGER (already exists, 0/1)

### **Add Minimal Fields**
```sql
ALTER TABLE users ADD COLUMN phone_country_code TEXT; -- For display formatting
```

### **Removed from Original Plan**
- ❌ `phone_verified_at` - Not needed initially, can add later for audit trails
- ❌ `sms_sessions` table - Plivo handles all session management, local tracking not required initially

> **Rationale**: Keep it simple. Plivo Verify API handles generation, storage, expiration, and validation. We only need to track the final verification status.

---

## **🔧 Backend Implementation**

### **Dependencies to Add**
```json
{
  "plivo": "^4.58.0",
  "libphonenumber-js": "^1.10.50",
  "zod": "^3.22.0"
}
```

### **Environment Variables**
```env
# Plivo Verify API Configuration
PLIVO_AUTH_ID=your_plivo_auth_id
PLIVO_AUTH_TOKEN=your_plivo_auth_token

# SMS Configuration (Optional - Plivo handles most of this)
SMS_RATE_LIMIT_MAX_ATTEMPTS=5
SMS_CODE_EXPIRY_MINUTES=10
```

### **Plivo Account Setup Steps**
1. **Create Plivo account** at [plivo.com](https://plivo.com)
2. **Navigate to Verify API** (separate from SMS API)
3. **Get Auth ID and Auth Token** from dashboard
4. **Enable Verify API** in your account
5. **Set up billing** (free credits available for testing)
6. **Test with provided test numbers** before production

### **Core Services**

#### **SMS Service (`lib/smsService.ts`)**
- **Phone validation** using Zod + libphonenumber-js
- **OTP session creation** via Plivo Verify API
- **OTP validation** via Plivo Verify API
- **Error handling** and fallbacks

#### **Why Both Zod AND libphonenumber-js?**
- **Zod**: Schema validation and TypeScript types (`z.string()`, `z.object()`)
- **libphonenumber-js**: Phone number intelligence:
  - **Parsing**: `"+1 (555) 123-4567"` → `"+15551234567"`
  - **Validation**: Is this a valid mobile number?
  - **Formatting**: Display vs storage formats
  - **Country detection**: Auto-detect country from number
  - **Type detection**: Mobile vs landline vs VoIP

```typescript
// They work together:
const phoneSchema = z.string().refine((phone) => {
  const parsed = parsePhoneNumber(phone); // libphonenumber-js
  return parsed?.isValid() && parsed?.getType() === 'MOBILE';
}, 'Invalid mobile phone number');
```

### **API Endpoints**

#### **POST /auth/sms/send-code**
```typescript
Request: {
  phone: string,
  userId?: string // Link to user after email verification
}

Response: {
  success: boolean,
  message: string,
  phone: string, // Formatted number
  sessionUuid: string, // Plivo session identifier
  expiresAt: number
}
```

#### **POST /auth/sms/verify-code**
```typescript
Request: {
  sessionUuid: string, // From send-code response
  code: string,
  userId: string // Link to verified user
}

Response: {
  success: boolean,
  message: string
}
```

#### **Update Existing Registration Flow**
- **POST /auth/verify-code** (email) - Update to store phone for later verification
- **GET /auth/me** - Include `phoneVerified` status in response

---

## **📱 Frontend Implementation**

### **Updated Screens**

#### **RegisterScreen (UPDATE EXISTING)**
- **Add phone input field** with country picker
- **Real-time validation** using Zod + libphonenumber-js
- **Store phone for later verification** after email verification
- **Clear error messages** for invalid phone numbers

#### **PhoneVerificationScreen (NEW)**
- **Similar to CodeVerificationScreen** but for SMS codes
- **6-digit SMS OTP input** with auto-focus
- **Countdown timer** showing code expiry
- **Resend SMS** button with rate limiting
- **Loading states** during verification

#### **CodeVerificationScreen (NO CHANGES)**
- **Keep existing email verification** logic
- **After email verification**, redirect to phone verification instead of profile creation

### **Updated Auth Flow**

#### **Registration Auth States (NO phoneRequired stage needed)**
```
unauthenticated → email verification → phone verification → profileRequired → authenticated
```

#### **Sign-in Auth States (UNCHANGED)**
```
unauthenticated → authenticated (no phone verification)
```

### **State Management Updates**

#### **Auth Store Changes**
- **Remove `phoneRequired` stage** - not needed since phone verification only happens during registration
- **Update registration flow** to include phone verification step
- **Keep existing sign-in flow** unchanged

#### **Navigation Updates**
```typescript
// AuthStackParamList - ADD
PhoneVerification: {
  phone: string;
  userId: string;
  message: string;
};

// Registration Flow
RegisterScreen → CodeVerificationScreen → PhoneVerificationScreen → CreateProfile

// Sign-in Flow (unchanged)
LoginScreen → Authenticated
```

---

## **🛡️ Security Implementation**

### **Rate Limiting**
- **Plivo Verify API** handles primary rate limiting
- **5 SMS per hour** per phone number (Plivo managed)
- **Application-level limits** for additional protection on registration attempts

### **Code Security**
- **Plivo Verify API** handles all OTP security:
  - **6-digit numeric codes** (100,000 combinations)
  - **10-minute expiry** for codes
  - **Single-use codes** (marked as used after verification)
  - **Secure random generation** using crypto libraries

### **Phone Number Protection**
- **Zod + libphonenumber-js validation**:
  - **E.164 format** normalization
  - **Mobile numbers only** (no landlines/VoIP)
  - **Country validation** against supported regions
  - **Format and length validation**

---

## **🚀 Deployment Plan**

### **Migration Strategy**
1. **Deploy backend** SMS endpoints (feature flagged)
2. **Update database schema** (add phone_country_code column)
3. **Deploy updated RegisterScreen** with phone input
4. **Deploy PhoneVerificationScreen** 
5. **Enable feature flag** for internal testing
6. **Gradual rollout** to new registrations only
7. **Full activation** after validation

### **Monitoring & Observability**
- **Registration completion rates** (with vs without phone verification)
- **SMS delivery rates** during registration
- **Cost tracking** for new user registrations
- **Error rate monitoring** with alerts
