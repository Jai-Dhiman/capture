# OAuth with PKCE Setup Guide

## Overview

This guide explains how to set up OAuth authentication with PKCE (Proof Key for Code Exchange) for Google and Apple in your Capture app. The implementation includes:

- ✅ **Secure PKCE implementation** for OAuth flows
- ✅ **Google OAuth** with authorization code flow
- ✅ **Apple OAuth** with identity tokens
- ✅ **Backend integration** with Cloudflare Workers
- ✅ **React Native integration** with Expo AuthSession
- ✅ **Type-safe implementation** with TypeScript

## Prerequisites

Before setting up OAuth, ensure you have:

1. **Google Developer Console** account
2. **Apple Developer** account  
3. **Expo development build** (OAuth requires native code)
4. **Backend environment** properly configured

## Backend Setup

### 1. Environment Variables

Add these environment variables to your Cloudflare Workers:

```bash
# Google OAuth
GOOGLE_CLIENT_ID="your-google-client-id.googleusercontent.com"
GOOGLE_CLIENT_SECRET="your-google-client-secret"

# Apple OAuth  
APPLE_CLIENT_ID="your.apple.service.identifier"
```

### 2. Google OAuth Configuration

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable the Google+ API
4. Go to "Credentials" → "Create Credentials" → "OAuth 2.0 Client ID"
5. Choose "Web application" 
6. Add authorized redirect URIs:
   ```
   https://auth.expo.io/@your-expo-username/your-app-slug
   http://localhost:19006 (for development)
   ```
7. Save the Client ID and Client Secret

### 3. Apple OAuth Configuration

1. Go to [Apple Developer Portal](https://developer.apple.com/)
2. Navigate to "Certificates, Identifiers & Profiles"
3. Create a new "Services ID"
4. Configure the service ID with your domain
5. Add authorized redirect URIs similar to Google
6. Save the Service ID

### 4. Backend Deployment

Deploy your updated backend with OAuth endpoints:

```bash
cd apps/server
npm run deploy
```

## Frontend Setup

### 1. Install Required Dependencies

```bash
cd apps/mobile
npx expo install expo-auth-session expo-crypto expo-web-browser
npm install buffer
```

### 2. Environment Variables

Add to your `.env` file:

```bash
# Google OAuth
EXPO_PUBLIC_GOOGLE_CLIENT_ID="your-google-client-id.googleusercontent.com"

# Apple OAuth  
EXPO_PUBLIC_APPLE_CLIENT_ID="your.apple.service.identifier"
```

### 3. App Configuration (app.json/app.config.js)

Add OAuth scheme to your Expo config:

```json
{
  "expo": {
    "scheme": "your-app-scheme",
    "platforms": ["ios", "android", "web"],
    "android": {
      "intentFilters": [
        {
          "action": "VIEW",
          "autoVerify": true,
          "data": [
            {
              "scheme": "https",
              "host": "auth.expo.io"
            }
          ],
          "category": ["BROWSABLE", "DEFAULT"]
        }
      ]
    }
  }
}
```

## Implementation

### 1. Using OAuth in Your Login Screen

```tsx
import React from 'react';
import { View, TouchableOpacity, Text } from 'react-native';
import { useOAuth } from '@/features/auth/hooks/useOAuth';

export function LoginScreen() {
  const { 
    loginWithGoogle, 
    loginWithApple, 
    isGoogleConfigured, 
    isAppleConfigured 
  } = useOAuth();

  return (
    <View>
      {/* Your existing email auth UI */}
      
      <View style={{ marginTop: 20 }}>
        <Text>Or continue with:</Text>
        
        {isGoogleConfigured && (
          <TouchableOpacity 
            onPress={() => loginWithGoogle.mutate()}
            disabled={loginWithGoogle.isPending}
            style={{ padding: 16, backgroundColor: '#4285F4', marginBottom: 8 }}
          >
            <Text style={{ color: 'white', textAlign: 'center' }}>
              {loginWithGoogle.isPending ? 'Signing in...' : 'Continue with Google'}
            </Text>
          </TouchableOpacity>
        )}
        
        {isAppleConfigured && (
          <TouchableOpacity 
            onPress={() => loginWithApple.mutate()}
            disabled={loginWithApple.isPending}
            style={{ padding: 16, backgroundColor: '#000', marginBottom: 8 }}
          >
            <Text style={{ color: 'white', textAlign: 'center' }}>
              {loginWithApple.isPending ? 'Signing in...' : 'Continue with Apple'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}
```

### 2. Testing OAuth Implementation

Use the provided example component to test your OAuth setup:

```tsx
import { OAuthButtonsExample } from '@/features/auth/examples/OAuthButtonsExample';

// Add to your test screen or development menu
export function TestOAuthScreen() {
  return <OAuthButtonsExample />;
}
```

## Security Features

### PKCE Implementation

The implementation includes several security measures:

1. **Code Verifier Generation**: Cryptographically secure random generation
2. **Code Challenge**: SHA256 hash of code verifier with base64url encoding
3. **State Parameter**: CSRF protection with random state values
4. **Secure Storage**: PKCE parameters stored securely in memory
5. **Automatic Cleanup**: Parameters cleared after use or on error

### Backend Security

1. **Token Validation**: Proper OAuth token exchange and validation
2. **User Verification**: Email verification status preserved from OAuth provider
3. **Session Management**: Same secure JWT system as email auth
4. **Rate Limiting**: OAuth endpoints protected with rate limiting
5. **Error Handling**: Secure error messages without sensitive data

## Troubleshooting

### Common Issues

1. **"OAuth not configured" error**
   - Check environment variables are set correctly
   - Ensure backend deployment includes new environment variables

2. **"Invalid redirect URI" error**
   - Verify redirect URIs match in OAuth provider settings
   - Check Expo slug and username are correct

3. **"Code exchange failed" error**
   - Verify backend OAuth endpoints are deployed
   - Check client ID/secret configuration

4. **Development vs Production**
   - Use different OAuth client IDs for dev/prod
   - Configure appropriate redirect URIs for each environment

### Debug Mode

Enable OAuth debugging by adding to your development build:

```tsx
// Add to your development menu
console.log('OAuth Configuration:', {
  googleConfigured: isGoogleConfigured,
  appleConfigured: isAppleConfigured,
  redirectUri: AuthSession.makeRedirectUri({ useProxy: true })
});
```

## Testing Checklist

Before deploying OAuth to production:

- [ ] Google OAuth works in development
- [ ] Apple OAuth works in development  
- [ ] Backend OAuth endpoints respond correctly
- [ ] User creation/login works for both providers
- [ ] Profile creation flow works for new OAuth users
- [ ] Session management works correctly
- [ ] Error handling provides good user experience
- [ ] Environment variables configured for production
- [ ] OAuth provider settings configured for production URLs

## Production Deployment

### Backend
1. Set production environment variables in Cloudflare Workers
2. Deploy updated backend with OAuth endpoints
3. Test OAuth endpoints with production credentials

### Frontend
1. Update environment variables for production
2. Create production builds with OAuth support
3. Test OAuth flows in production environment

### OAuth Providers
1. Update redirect URIs for production domains
2. Verify OAuth provider settings
3. Test authentication flows end-to-end

## Maintenance

### Regular Tasks
- Monitor OAuth provider API changes
- Update dependencies (expo-auth-session, expo-crypto)
- Review and rotate OAuth credentials periodically
- Monitor OAuth success/failure rates
- Update OAuth scopes as needed

### Security Updates
- Keep expo-crypto updated for security patches
- Review PKCE implementation for security best practices
- Monitor OAuth provider security advisories
- Update redirect URI configurations as needed

## Support

For technical issues:

1. Check Expo AuthSession documentation
2. Review OAuth provider documentation (Google/Apple)
3. Check Cloudflare Workers logs for backend issues
4. Use the provided debug utilities
5. Test with the OAuth example component

---

**Note**: This OAuth implementation is production-ready but should be thoroughly tested in your specific environment before deployment. The PKCE implementation follows OAuth 2.1 security best practices. 