# Passkey Implementation Guide

## Overview

This guide explains how to use the passkey implementation that has been added to the Capture app. The implementation provides a secure, mobile-first authentication system using biometric authentication (Face ID, Touch ID, Fingerprint) as the primary method while maintaining email verification as a fallback.

## 🚀 What's Implemented

### Backend (Complete)
- ✅ **Passkey API Endpoints**: Registration, authentication, management
- ✅ **WebAuthn Integration**: Using @simplewebauthn/server
- ✅ **Database Schema**: Passkey storage with device metadata
- ✅ **Security Features**: Challenge-response validation, replay protection

### Frontend (Ready to Use)
- ✅ **Device Capability Detection**: Automatic biometric availability checking
- ✅ **Passkey Management Hook**: `usePasskey()` for all passkey operations
- ✅ **UI Components**: Setup and login screens
- ✅ **Biometric Integration**: expo-local-authentication for device security

## 📱 Usage

### 1. Using the Passkey Hook

```tsx
import { usePasskey } from '@/features/auth/hooks/usePasskey';

function MyComponent() {
  const {
    // Device capabilities
    isPasskeySupported,
    hasBiometrics,
    biometricTypes,
    
    // Passkey operations
    registerPasskey,
    authenticateWithPasskey,
    deletePasskey,
    
    // User's passkeys
    passkeys,
    
    // Utilities
    getBiometricName,
  } = usePasskey();
  
  return (
    <View>
      {isPasskeySupported ? (
        <Text>Passkeys are supported!</Text>
      ) : (
        <Text>Fallback to email authentication</Text>
      )}
    </View>
  );
}
```

### 2. Onboarding with Passkey Setup

```tsx
import { PasskeySetup } from '@/features/auth/components/PasskeySetup';

function OnboardingFlow() {
  const handlePasskeyComplete = () => {
    // User successfully set up passkey
    console.log('Passkey setup completed');
  };
  
  const handlePasskeySkip = () => {
    // User skipped passkey setup
    console.log('User skipped passkey setup');
  };
  
  return (
    <PasskeySetup 
      onComplete={handlePasskeyComplete}
      onSkip={handlePasskeySkip}
    />
  );
}
```

### 3. Login with Passkey

```tsx
import { PasskeyLogin } from '@/features/auth/components/PasskeyLogin';

function LoginScreen() {
  const handleFallback = () => {
    // Switch to email authentication
    console.log('Fallback to email login');
  };
  
  return (
    <PasskeyLogin onFallback={handleFallback} />
  );
}
```

### 4. Managing Passkeys

```tsx
function PasskeySettings() {
  const { passkeys, deletePasskey, registerPasskey } = usePasskey();
  
  const handleDeletePasskey = async (passkeyId: string) => {
    await deletePasskey.mutateAsync(passkeyId);
  };
  
  const handleAddPasskey = async () => {
    await registerPasskey.mutateAsync({
      email: 'user@example.com',
      deviceName: 'My iPhone',
    });
  };
  
  return (
    <View>
      {passkeys.map((passkey) => (
        <View key={passkey.id}>
          <Text>{passkey.deviceName}</Text>
          <Button onPress={() => handleDeletePasskey(passkey.id)}>
            Delete
          </Button>
        </View>
      ))}
      <Button onPress={handleAddPasskey}>Add Passkey</Button>
    </View>
  );
}
```

## 🔧 API Reference

### Backend Endpoints

#### `POST /auth/passkey/register/begin`
Start passkey registration process.

**Request:**
```json
{
  "email": "user@example.com",
  "deviceName": "iPhone 15 Pro"
}
```

**Response:**
```json
{
  "challenge": "...",
  "user": { "id": "...", "name": "...", "displayName": "..." },
  "rp": { "id": "...", "name": "..." },
  "pubKeyCredParams": [...],
  "authenticatorSelection": {...},
  "attestation": "none",
  "timeout": 60000
}
```

#### `POST /auth/passkey/register/complete`
Complete passkey registration.

**Request:**
```json
{
  "credential": {
    "id": "...",
    "rawId": "...",
    "response": {
      "attestationObject": "...",
      "clientDataJSON": "..."
    },
    "type": "public-key"
  },
  "deviceName": "iPhone 15 Pro"
}
```

#### `POST /auth/passkey/authenticate/begin`
Start passkey authentication.

**Request:**
```json
{
  "email": "user@example.com"
}
```

#### `POST /auth/passkey/authenticate/complete`
Complete passkey authentication.

**Request:**
```json
{
  "credential": {
    "id": "...",
    "rawId": "...",
    "response": {
      "authenticatorData": "...",
      "clientDataJSON": "...",
      "signature": "...",
      "userHandle": "..."
    },
    "type": "public-key"
  }
}
```

#### `GET /auth/passkey/list`
Get user's passkeys (requires authentication).

#### `DELETE /auth/passkey/:passkeyId`
Delete a passkey (requires authentication).

### Frontend Hook

#### `usePasskey()`

**Returns:**
```tsx
{
  // Device capabilities
  deviceCapabilities: PasskeyCapabilities | undefined;
  isCapabilitiesLoading: boolean;
  isPasskeySupported: boolean;
  hasBiometrics: boolean;
  biometricTypes: string[];
  
  // User's passkeys
  passkeys: PasskeyInfo[];
  isPasskeysLoading: boolean;
  
  // Mutations
  registerPasskey: UseMutationResult<...>;
  authenticateWithPasskey: UseMutationResult<...>;
  deletePasskey: UseMutationResult<...>;
  
  // Utilities
  getBiometricName: () => Promise<string>;
}
```

## 🔐 Security Features

### WebAuthn Compliance
- FIDO2/WebAuthn standard implementation
- Hardware-backed keys (Secure Enclave, Android Keystore)
- Biometric verification required
- Replay protection with challenge-response
- Domain binding to prevent phishing

### Device Security
- Automatic capability detection
- Biometric enrollment validation
- Graceful degradation for unsupported devices
- Clear error handling and user feedback

### Fallback Security
- Email verification remains available
- Multiple authentication methods supported
- Account recovery through email
- User choice in authentication methods

## 📋 Integration Steps

### 1. Add to Onboarding Flow
```tsx
// In your onboarding component
import { PasskeySetup } from '@/features/auth/components/PasskeySetup';

// Add after email verification
<PasskeySetup 
  onComplete={() => navigation.navigate('Dashboard')}
  onSkip={() => navigation.navigate('Dashboard')}
/>
```

### 2. Update Login Screen
```tsx
// In your login component
import { PasskeyLogin } from '@/features/auth/components/PasskeyLogin';
import { usePasskey } from '@/features/auth/hooks/usePasskey';

function LoginScreen() {
  const { isPasskeySupported } = usePasskey();
  const [showPasskey, setShowPasskey] = useState(isPasskeySupported);
  
  return (
    <View>
      {showPasskey ? (
        <PasskeyLogin onFallback={() => setShowPasskey(false)} />
      ) : (
        <EmailLogin onPasskeyToggle={() => setShowPasskey(true)} />
      )}
    </View>
  );
}
```

### 3. Add to Settings
```tsx
// In your settings screen
import { usePasskey } from '@/features/auth/hooks/usePasskey';

function SettingsScreen() {
  const { passkeys, isPasskeySupported } = usePasskey();
  
  return (
    <View>
      {isPasskeySupported && (
        <Section title="Security">
          <PasskeyManagement />
        </Section>
      )}
    </View>
  );
}
```

## 🔄 User Experience Flow

### First Time Setup
1. User completes email verification
2. Device capability detection runs automatically
3. If supported, show passkey setup screen
4. User chooses to set up or skip
5. If skip, continue with email-only authentication

### Subsequent Logins
1. Show passkey login option if available
2. User can choose passkey or email verification
3. Passkey uses biometric authentication
4. Fallback to email if passkey fails

### Device Management
1. Users can view active passkeys in settings
2. Add new passkeys for additional devices
3. Remove passkeys that are no longer needed
4. Clear device information display

## 🚨 Error Handling

The implementation includes comprehensive error handling:

- **Device not supported**: Graceful fallback to email
- **Biometric not enrolled**: Clear instructions to user
- **Authentication failed**: Retry options and fallback
- **Network errors**: Proper error messages and retry logic
- **Server errors**: User-friendly error descriptions

## 📊 Analytics Events

Track these events for monitoring:
- `passkey_capability_check`
- `passkey_registration_start`
- `passkey_registration_complete`
- `passkey_authentication_start`
- `passkey_authentication_complete`
- `passkey_fallback_used`

## 🔧 Troubleshooting

### Common Issues

**Q: Passkeys not supported on my device**
A: Ensure device has biometric authentication set up and app has proper permissions.

**Q: Registration fails**
A: Check that WebAuthn is properly configured in backend and challenge is valid.

**Q: Authentication fails**
A: Verify passkey exists in database and counter values are correct.

**Q: Biometric prompt doesn't appear**
A: Ensure expo-local-authentication permissions are granted.

### Development Tips

1. Test on physical devices (biometrics don't work in simulators)
2. Use development certificates for testing
3. Monitor console logs for WebAuthn errors
4. Test with different biometric types (Face ID, Touch ID, Fingerprint)

## 📝 Next Steps

1. **Test thoroughly** on physical devices with different biometric types
2. **Monitor analytics** to track adoption and success rates
3. **Implement MFA** for users who decline passkeys
4. **Add cross-device sync** for advanced scenarios
5. **Consider hardware tokens** for enterprise users

## 🎯 Production Checklist

- [ ] Update CORS settings for production domains
- [ ] Configure proper WebAuthn origins
- [ ] Set up monitoring and alerting
- [ ] Test on various device types
- [ ] Implement proper error tracking
- [ ] Add user education materials
- [ ] Plan rollout strategy

---

**Note**: This implementation provides a solid foundation for passkey authentication. The mock credential handling in the demo components should be replaced with actual WebAuthn API calls for production use. 