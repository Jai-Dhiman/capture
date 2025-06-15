# Passkey Implementation Plan - Mobile First

## Overview

This document outlines the implementation plan for adding passkey (WebAuthn) support to Capture's mobile-first authentication system. The implementation focuses on enhancing security through biometric authentication while maintaining the existing passwordless email-based flow as a fallback.

## 🎯 **Implementation Goals**

### **Primary Objectives**
- **Mobile-First**: iOS and Android native app support only (no web)
- **Security-First**: Passkeys as primary auth method where supported
- **User Choice**: Optional passkey setup during onboarding
- **MFA Enforcement**: Users who decline passkeys must set up alternative MFA
- **Single Device**: One device per user assumption (mobile-only usage)

### **User Experience Flow**
1. User completes email verification (existing flow)
2. **NEW**: Device capability detection during onboarding
3. **NEW**: Offer passkey setup if device supports it
4. If user accepts → Register passkey, complete onboarding
5. If user declines → Force MFA setup (TOTP/SMS) before account access

## 📱 **Device Support Strategy**

### **Supported Platforms**
- **iOS 16+**: Face ID, Touch ID
- **Android 9+**: Fingerprint, Face Unlock, Pattern/PIN
- **Secure Hardware**: TPM, Secure Enclave, Android Keystore

### **Detection Logic**
- **Real-time capability detection** during app launch
- **Graceful degradation** for unsupported devices
- **Clear user communication** about device compatibility
- **Fallback prompts** for alternative security methods

### **Unsupported Device Handling**
- Continue with existing email + MFA flow
- No passkey options presented
- Clear explanation of security alternatives
- Future upgrade notifications when device supports passkeys

## 🔧 **Technical Architecture**

### **Backend Extensions**

#### **Database Schema**
Extends existing user authentication tables:
- **Passkey credentials storage** (credential ID, public key, counter)
- **Device metadata** (device name, type, registration date)
- **User security preferences** (preferred auth method, MFA settings)

#### **API Endpoints**
- `GET /auth/passkey/capabilities` - Check if passkeys available for user
- `POST /auth/passkey/register/begin` - Start passkey registration
- `POST /auth/passkey/register/complete` - Complete passkey registration
- `POST /auth/passkey/authenticate/begin` - Start passkey authentication
- `POST /auth/passkey/authenticate/complete` - Complete passkey authentication

### **Frontend Integration**

#### **New Screens**
- **Passkey Setup Screen**: Onboarding flow integration
- **Passkey Management**: Settings screen for passkey management
- **Biometric Prompt**: Native biometric authentication UI
- **Fallback Selection**: MFA method selection for non-passkey users

#### **Authentication Flow Updates**
- **Login enhancement**: Passkey option alongside email
- **Registration enhancement**: Passkey setup after email verification
- **Settings integration**: Passkey management in user settings

## 🛡️ **Security Implementation**

### **Passkey Security Features**
- **FIDO2/WebAuthn compliance**: Industry-standard implementation
- **Hardware-backed keys**: Secure Enclave (iOS), Android Keystore
- **Biometric verification**: Face ID, Touch ID, Fingerprint
- **Replay protection**: Challenge-response with counters
- **Domain binding**: Credentials tied to app/domain

### **Fallback Security Requirements**
Users who decline passkeys must configure ONE of:
- **TOTP Authenticator**: Google Authenticator, Authy, 1Password
- **SMS Verification**: Phone number + verification codes
- **Recovery Keys**: 24-character backup codes

### **Progressive Security Model**
- **Level 1**: Email verification (minimum)
- **Level 2**: Email + Passkey OR Email + MFA
- **Level 3**: Email + Passkey + Recovery keys (future)

## 📋 **Implementation Phases**

### **Phase 1: Foundation (Week 1-2)**
- Device capability detection utility
- Backend passkey endpoints
- Database schema updates
- Basic passkey registration flow

### **Phase 2: Core Implementation (Week 3-4)**
- Passkey registration during onboarding
- Biometric authentication integration
- Login flow with passkey support
- Error handling and fallbacks

### **Phase 3: MFA Integration (Week 5-6)**
- TOTP authenticator setup for non-passkey users
- Recovery key generation
- Settings screen for security management
- User education and guidance

### **Phase 4: Polish & Testing (Week 7-8)**
- Comprehensive error handling
- Performance optimization
- Security testing and validation
- User experience refinement

## 🔄 **User Onboarding Flow**

### **Current Flow Enhancement**

### **Security Setup Decision Tree**
1. **Device Check**: Passkey support detected?
   - **YES**: Offer passkey setup
     - User accepts → Register passkey → Complete onboarding
     - User declines → Force MFA selection → Setup MFA → Complete onboarding
   - **NO**: Show MFA options → Setup MFA → Complete onboarding

### **User Communication Strategy**
- **Clear benefits**: "Sign in with your face/fingerprint"
- **Security emphasis**: "More secure than passwords"
- **Choice respect**: "You can set up other security methods instead"
- **Future flexibility**: "You can add passkeys later in settings"

## 🔐 **Authentication Method Priority**

### **Login Attempt Order**
1. **Passkey** (if registered and device supports)
2. **Email + Code** (always available)
3. **Recovery methods** (if MFA configured)

### **Account Recovery Strategy**
- **Passkey lost/broken**: Email verification + MFA challenge
- **Device replacement**: Email verification + recovery key
- **Complete lockout**: Customer support + identity verification

## 📊 **Success Metrics**

### **Adoption Targets**
- **Passkey registration rate**: 60%+ of eligible devices
- **Daily passkey usage**: 80%+ of passkey-enabled users
- **Support ticket reduction**: 40% reduction in login issues
- **User satisfaction**: Improved login experience ratings

### **Security Metrics**
- **Account takeover reduction**: Baseline measurement and improvement
- **Phishing resistance**: Elimination of credential-based attacks
- **User error reduction**: Fewer failed login attempts

## 🚨 **Risk Mitigation**

### **Technical Risks**
- **Device compatibility issues**: Comprehensive testing matrix
- **Biometric failures**: Multiple fallback methods
- **User confusion**: Clear UI/UX and help documentation

### **Security Risks**
- **Passkey loss**: Recovery key system
- **Device theft**: Remote passkey invalidation
- **Implementation bugs**: Security audits and penetration testing

### **User Experience Risks**
- **Friction increase**: Optional setup, clear benefits
- **Support burden**: Comprehensive help documentation
- **Feature abandonment**: Usage analytics and iteration

## 🔄 **Future Enhancements**

### **Advanced Features** (Post-MVP)
- **Cross-device sync**: Apple Keychain, Google Password Manager
- **Multiple passkeys**: Backup device registration
- **Conditional UI**: Passkey autofill in login forms
- **Admin controls**: Enterprise passkey management

### **Integration Opportunities**
- **Third-party apps**: Passkey-based API authentication
- **Hardware tokens**: FIDO2 security key support
- **Shared credentials**: Family/team account access

---

## 📝 **Implementation Notes**

### **Libraries & Dependencies**
- **iOS**: AuthenticationServices framework
- **Android**: androidx.biometric, FIDO2 API
- **React Native**: react-native-passkey (community)
- **Backend**: @simplewebauthn/server

### **Configuration Requirements**
- **iOS**: Associated Domains, Keychain Sharing
- **Android**: Asset Links, Biometric permissions
- **Server**: HTTPS, WebAuthn origins configuration

### **Testing Strategy**
- **Device matrix**: iOS 16+, Android 9+ across different manufacturers
- **Biometric scenarios**: Face ID, Touch ID, Fingerprint, fallbacks
- **Edge cases**: Network failures, device switches, biometric changes

---

**Status**: Planning Phase  
**Target Completion**: 8 weeks  
**Priority**: High (Security Enhancement)  
**Dependencies**: Existing email authentication system, MFA implementation
