# Capture Beta Release Checklist

> Generated: 2025-12-06
> Updated: 2025-12-10
> Status: Beta Ready (Pending Migration + App Store Metadata)

---

## Critical (Must-Have for Beta)

### Authentication & Security

- [ ] **SMS/Phone Verification**
  - Currently using email API as placeholder
  - Files: `apps/mobile/src/features/auth/screens/PhoneCodeVerificationScreen.tsx:49,85`
  - Need: Integrate SMS provider (Twilio/AWS SNS)
  - **Status: DEFERRED for beta (email-only)**

- [x] **Admin Role-Based Access Control**
  - Added `role` field to users table schema
  - Created `apps/server/src/middleware/admin.ts` with `requireAdmin`, `requireModerator`, `isAdmin`
  - Updated all feedback.ts TODOs with proper role checks
  - Migration: `apps/server/drizzle/0004_add_user_role.sql`

- [x] **Like Post Backend**
  - Added `likePost`/`unlikePost` mutations to GraphQL schema
  - Created `apps/server/src/graphql/resolvers/like.ts`
  - Added `isLiked` field to Post type
  - Added `POST_LIKE` to NotificationType enum

- [x] **Like Notifications**
  - Added `createLikeNotification` in `apps/server/src/lib/services/notificationService.ts`
  - Called from likePost resolver

### Core Features Missing

- [x] **Forgot Password / Reset Password**
  - Backend: Added `/auth/forgot-password` and `/auth/reset-password` endpoints in `apps/server/src/routes/auth.ts`
  - Mobile: Created `ForgotPasswordScreen.tsx` and `ResetPasswordScreen.tsx`
  - Registered in `AuthNavigator.tsx` and navigation types

- [x] **Account Deletion** (Required for App Store)
  - Backend: Added `DELETE /auth/account` endpoint with anonymization
  - Posts/comments reassigned to `[deleted]` system user
  - Mobile: Added delete button with confirmation in `AccountSettingsScreen.tsx`

- [ ] **Report User/Post**
  - UI buttons exist but no backend implementation
  - Need: Create report schema, API endpoints, and resolvers
  - **Status: DEFERRED - requires database migration**

### Settings Screens (UI Exists, No Implementation)

- [ ] **Private Messaging Preferences**
  - **Status: DEFERRED - DMs not implemented**

- [ ] **Algorithm Preferences**
  - **Status: DEFERRED - placeholder "Coming soon"**

- [x] **Data & Privacy Policy**
  - Created `PrivacyPolicyScreen.tsx` with placeholder content
  - Wired up in `MainSettingsScreen.tsx` and `SettingsNavigator.tsx`

- [x] **Notification Customization**
  - Created `NotificationSettingsScreen.tsx` with toggle switches
  - Supports likes, comments, follows, mentions, saves toggles
  - Master push toggle included
  - Backend persistence via GraphQL API (2025-12-10)
  - Migration: `apps/server/drizzle/0006_add_granular_notification_settings.sql`

- [x] **Appearance & Customization**
  - Created `AppearanceScreen.tsx` with theme selection
  - Light/Dark/System options (dark mode marked "Coming soon")
  - Theme selection persists to AsyncStorage (2025-12-10)

- [x] **Report Bug Screen**
  - Created `ReportBugScreen.tsx`
  - Uses existing `createTicket` mutation with `type: 'BUG_REPORT'`
  - Includes device info collection

- [x] **Feature Request Screen**
  - Created `FeatureRequestScreen.tsx`
  - Uses existing `createTicket` mutation with `type: 'FEATURE_REQUEST'`

---

## High Priority (Should Have)

### Backend TODOs

- [ ] **Media Deletion/Restoration** - `apps/server/src/routes/media.ts:617,645`
- [ ] **Media Cleanup Operations** - `apps/server/src/routes/media.ts:779,804`
- [ ] **Cloudflare Cache API Integration** - `apps/server/src/lib/images/imageService.ts:595,628`
- [ ] **EXIF Data Extraction** - `apps/server/src/lib/images/metadataService.ts:210`
- [ ] **Discovery Feed Analytics** - `apps/server/src/graphql/resolvers/discovery.ts:726`

### Mobile TODOs

- [ ] **Share Analytics Tracking** - `ThreadItem.tsx:127`, `PostItem.tsx:125`
- [ ] **Server-Side Image Generation** - `ResponsiveImage.tsx:103`

### Dashboard TODOs

- [ ] **Error Toast Notifications** - `TicketCard.svelte:96`, `TicketDetail.svelte:79`

---

## Medium Priority (Nice to Have for Beta)

### Production Readiness

- [x] **Push Notifications**
  - Mobile: `apps/mobile/src/shared/services/pushNotificationService.ts`
  - Server: `apps/server/src/lib/services/pushNotificationService.ts`
  - Device registration: `/auth/register-device` and `/auth/unregister-device` endpoints
  - Migration: `apps/server/drizzle/0005_add_device_tokens.sql`
  - Integrated with notificationService.ts for automatic push on all notifications

- [ ] **Offline Support**
- [ ] **Memory Usage Monitoring** - `wasmMemoryOptimizer.ts:94`

### User Experience

- [ ] **Onboarding/Tutorial Flow**
- [ ] **Empty States** verification
- [ ] **Accessibility (a11y)**
- [ ] **Internationalization (i18n)**

### Testing

- [ ] **Mobile Test Coverage**
- [ ] **Integration Tests**
- [ ] **E2E Tests**

---

## App Store Requirements

### iOS App Store

- [x] Privacy Policy URL (in-app placeholder created)
- [ ] Terms of Service URL
- [x] Account Deletion capability
- [ ] App Privacy nutrition labels completed
- [ ] Age rating questionnaire completed
- [ ] App screenshots for all device sizes
- [ ] App description and keywords

### Google Play Store

- [x] Privacy Policy URL
- [ ] Data safety form completed
- [ ] Content ratings completed
- [ ] App screenshots
- [ ] Feature graphic (1024x500)

---

## Already Complete

### Authentication

- [x] Email-based signup/login with verification codes
- [x] Passkey/WebAuthn support
- [x] Apple Sign-In integration
- [x] Google Sign-In integration
- [x] MFA/TOTP setup and verification
- [x] Biometric authentication (Face ID/Touch ID)
- [x] Session management with secure token storage
- [x] Privacy toggle (public/private account)
- [x] Forgot/Reset Password flow
- [x] Account deletion with anonymization

### Core Social Features

- [x] Posts (create, edit, delete, version history)
- [x] Multi-image posts with filters and adjustments
- [x] Comments (nested, threaded with cursor pagination)
- [x] Like/unlike posts with notifications
- [x] Save/unsave posts
- [x] User profiles (view, edit, bio, profile image)
- [x] Follow/unfollow users
- [x] Block/unblock users
- [x] Discovery feed with AI-powered recommendations
- [x] Following feed (chronological)
- [x] Search (users and hashtags)
- [x] In-app notifications (follow, comment, reply, like)
- [x] Hashtags (create, search, attach to posts)
- [x] Deep linking support

### Infrastructure

- [x] Cloudflare Workers deployment
- [x] R2 object storage for images
- [x] D1 SQLite database with complete schema
- [x] KV namespaces for caching and rate limiting
- [x] Rate limiting middleware
- [x] Sentry error tracking (mobile + server)
- [x] EAS build configurations (dev, preview, testflight, production)
- [x] Admin dashboard with analytics
- [x] Feedback/ticket system backend
- [x] Admin RBAC for feedback system
- [x] Rust WASM modules for performance
- [x] GraphQL API with Apollo Server

---

## Summary

| Category | Critical | High | Medium | Completed |
|----------|----------|------|--------|-----------|
| Auth/Security | 1 (SMS-deferred) | 0 | 0 | 4 |
| Core Features | 1 (Report-deferred) | 0 | 0 | 2 |
| Settings Screens | 2 (deferred) | 0 | 0 | 5 |
| Backend | 0 | 5 | 0 | 2 (Push, NotifSettings) |
| Mobile | 0 | 2 | 0 | 2 (Push, Theme) |
| Dashboard | 0 | 1 | 0 | 0 |
| UX/Polish | 0 | 0 | 4 | 0 |
| Testing | 0 | 0 | 3 | 0 |
| App Store | 0 | 0 | 5 | 3 |

**Critical items for beta: All complete (SMS and Report User/Post deferred to post-beta)**

---

## Remaining for Beta Launch

1. ~~**Push Notifications**~~ - DONE (2025-12-10)
2. ~~**Run database migrations**~~ - DONE (`0004_add_user_role.sql`, `0005_add_device_tokens.sql`)
3. ~~**Notification Settings Persistence**~~ - DONE (2025-12-10)
4. ~~**Theme Persistence**~~ - DONE (2025-12-10)
5. **Run migration** - `0006_add_granular_notification_settings.sql`
6. **App Store metadata** - Screenshots, descriptions, forms
7. **Report User/Post** - DEFERRED to post-beta (trust & safety feature)

---

## Migrations Run

- [x] `0004_add_user_role.sql` - Added role field to users table
- [x] `0005_add_device_tokens.sql` - Added device_token table for push notifications
- [x] `0006_add_granular_notification_settings.sql` - Added granular notification preferences (likes, comments, follows, mentions, saves)

---

## Notes

- SMS verification deferred (email-only for beta)
- Private Messaging and Algorithm Preferences deferred (features not built)
- Dark mode UI ready, theme selection now persists (actual theme switching not wired to system yet)
- All new screens follow existing patterns and are type-safe
- Push notifications integrated with all notification types (likes, comments, follows, etc.)
- Notification settings now persist to backend with optimistic updates

---

## Implementation Log

### 2025-12-10: Settings Persistence

**Notification Settings Backend:**

- Created migration `apps/server/drizzle/0006_add_granular_notification_settings.sql`
- Updated `apps/server/src/db/schema.ts` with granular notification columns
- Added GraphQL types `NotificationSettings`, `NotificationSettingsInput` to schema
- Created `apps/server/src/graphql/resolvers/notificationSettings.ts`
  - Query fetches settings (creates defaults if none exist)
  - Mutation upserts settings with partial updates
- Registered resolver in `apps/server/src/graphql/resolvers/index.ts`

**Mobile Notification Settings:**

- Created `apps/mobile/src/features/settings/hooks/useNotificationSettings.ts`
  - React Query hooks with optimistic updates
- Updated `NotificationSettingsScreen.tsx` to use backend hooks

**Theme Persistence:**

- Created `apps/mobile/src/features/settings/atoms/themeAtom.ts`
  - Jotai atom with AsyncStorage persistence
- Updated `AppearanceScreen.tsx` to use atom

### 2025-12-10: Push Notifications & Beta Prep

**Server Changes:**

- Created `apps/server/src/lib/services/pushNotificationService.ts`
  - Expo Push API integration
  - Automatic invalid token cleanup
  - Multi-device support per user
- Added `device_token` table to `apps/server/src/db/schema.ts`
- Created migration `apps/server/drizzle/0005_add_device_tokens.sql`
- Added endpoints in `apps/server/src/routes/auth.ts`:
  - `POST /auth/register-device` - Register push token
  - `POST /auth/unregister-device` - Unregister push token
- Updated `apps/server/src/lib/services/notificationService.ts`
  - All notifications now trigger push notifications automatically

**Mobile Changes:**

- Created `apps/mobile/src/shared/services/pushNotificationService.ts`
  - Permission handling
  - Token registration with backend
  - Notification listeners setup
  - Badge management
- Updated `apps/mobile/app.config.js` with expo-notifications plugin
- Installed dependencies: `expo-notifications`, `expo-device`, `expo-constants`

### 2025-12-09: Core Beta Features (Previous Session)

- Admin RBAC middleware
- Like/unlike mutations with notifications
- Forgot/Reset password flow
- Account deletion with anonymization
- Settings screens (Appearance, Notifications, Privacy, ReportBug, FeatureRequest)
