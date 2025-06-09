# Migration Context: Supabase Auth → Cloudflare Workers Auth

## Purpose & Scope
- Replace Supabase Auth with a Workers-based identity stack on Cloudflare.
- Consolidate relational data (users + profiles) into D1 and transient state (refresh tokens, one-time codes) into KV.
- Start from scratch—no user-migration required.

## Current vs Target Architecture

| Layer          | Today (Supabase)                                    | Tomorrow (Workers Auth)                                        |
|----------------|-----------------------------------------------------|----------------------------------------------------------------|
| HTTP server    | Hono → Supabase REST `/auth` & GraphQL              | Cloudflare Workers (Hono) for `/auth`, `/api`, `/graphql`      |
| Relational DB  | Supabase Postgres (users) + D1 (profiles)           | Single D1 DB with `users` + `profiles` tables                 |
| Tokens & OTP   | Supabase-managed JWTs, refresh tokens, SMS via Supabase | JWTs signed in Workers + refresh tokens in KV + OTP codes in KV |
| Client logic   | Supabase SDK + custom fetch wrappers + Zustand      | Custom `workersAuthApi` + shared `apiClient` + Zustand         |

## Progress So Far

**Phase 1: Teardown & Schema Setup**
- **DONE:** Stripped Supabase client from mobile app (`supabaseAuthClient.ts`, `OAuth.tsx` removed).
- **DONE:** Commented out Supabase SDK usage in server-side Hono auth routes (`apps/server/src/routes/auth.ts`) and middleware (`apps/server/src/middleware/auth.ts`). Placeholders added.
- **DONE:** Defined D1 schema for a new `users` table in `apps/server/src/db/schema.ts`.
  - `id` (PK), `email` (unique), `passwordHash`, `emailVerified` (bool), `phone` (nullable), `created_at`, `updated_at`.
- **DONE:** Updated foreign key references in existing D1 tables (`profile`, `post`, etc.) to point to the new `users.id` instead of `profile.userId`.
- **Done:** User to generate and apply D1 migrations:
  ```bash
  # In apps/server directory
  npx drizzle-kit generate:sqlite --schema=src/db/schema.ts --out=migrations
  npx wrangler d1 migrations apply YOUR_DATABASE_NAME --local # (or without --local for remote)
  ```

**Phase 2: Core Authentication Logic in Cloudflare Worker**
- **DONE:** Implemented password hashing and verification using Web Crypto PBKDF2 API in `apps/server/src/routes/auth.ts`.
  - `hashPassword(password)`: Generates salt, derives key using PBKDF2 (SHA-256, 100k iterations), stores `salt.hash`.
  - `verifyPassword(password, storedHash)`: Verifies password against stored salt and hash using constant-time comparison.
- **DONE:** Added `JWT_SECRET` (string) and `REFRESH_TOKEN_KV` (KVNamespace) to `Bindings` type in `apps/server/src/types/index.ts`.
- **DONE:** Implemented JWT-based authentication:
  - `generateJwtToken(userId, email, env)` in `apps/server/src/routes/auth.ts`:
    - Creates a signed JWT access token (15 min expiry) using `hono/jwt` and `env.JWT_SECRET`. Payload: `sub`, `email`, `iat`, `exp`.
    - Generates an opaque refresh token (nanoid).
    - Stores `rt_{refreshToken}` -> `userId` in `REFRESH_TOKEN_KV` with a 7-day expiry.
  - Updated `POST /login` route:
    - Validates credentials, then calls `generateJwtToken`.
    - Returns `access_token`, `refresh_token`, and `expires_at` (for access token).
  - Updated `POST /refresh` route:
    - Validates `refresh_token` against `REFRESH_TOKEN_KV`.
    - Deletes used refresh token from KV (rotation).
    - Issues new access and refresh tokens.
  - Updated `POST /logout` route:
    - Deletes the provided `refresh_token` from KV if present.
- **DONE:** Updated `authMiddleware` (`apps/server/src/middleware/auth.ts`):
  - Verifies JWT access token from `Authorization: Bearer` header using `hono/jwt` and `env.JWT_SECRET`.
  - Populates `c.set('user', { id, email })` from token payload.
- **DO:** Configure `JWT_SECRET` and `REFRESH_TOKEN_KV` in `wrangler.toml` and Cloudflare dashboard (secrets & KV namespace creation).

## Remaining Step-by-Step Plan

**1. Implement Remaining Auth Routes & Features**
   - **PENDING:** `POST /register`:
     - Currently registers user but doesn't auto-login or send verification.
     - **Consider:** Auto-login user after registration by calling `generateJwtToken`?
     - **Consider:** Trigger email verification flow.
   - **PENDING:** Email Verification (`GET /verify-email?token=...`, `POST /send-verification-email`):
     - Generate unique, short-lived verification token (store in KV or D1 with `userId` and `expiresAt`).
     - Send email with verification link. (Requires email sending service integration).
     - Endpoint to verify token and update `users.emailVerified` flag in D1.
   - **PENDING:** Password Reset (`POST /reset-password`, `POST /update-password` (with token)):
     - `POST /reset-password`: Generate reset token, store in KV, send email.
     - `POST /update-password`: If reset token provided (and valid from KV), allow updating `passwordHash` for the associated user. Invalidate reset token.
   - **PENDING (Optional):** `POST /send-otp`, `POST /verify-otp` if phone number authentication/verification is needed.
     - Store OTP codes in KV with TTL. (Requires SMS provider integration).

**2. Wire in Email (& SMS) Providers**
   - **PENDING:** Integrate an email sending service (e.g., Mailgun, SendGrid, Resend) for verification and password reset emails.
     - Add API keys as secrets. Call from Worker.
   - **PENDING (Optional):** Integrate SMS provider (e.g., Twilio) if OTP is implemented.

**3. Integrate GraphQL / private APIs**
   - **PARTIALLY DONE:** `authMiddleware` is in place for protecting Hono routes.
   - **PENDING:** Ensure GraphQL resolvers (if using Hono's Apollo integration or similar) correctly use the `user` object from `c.get('user')` provided by the `authMiddleware`.
     - Existing GraphQL setup: `apps/server/src/index.ts` uses `authMiddleware` before the GraphQL handler. Context propagation seems to be:
       ```typescript
        const contextValue: ContextType = { // from apps/server/src/index.ts
          env: c.env,
          user: c.get("user"), // This should now be the AppUser from our JWT
        };
       ```
       This *should* work. Needs testing once client calls protected GQL operations.

**4. Mobile client migration**
   - **PENDING:** Point `API_URL` in the mobile app at your Worker's domain.
   - **PENDING:** Create `apps/mobile/src/features/auth/lib/workersAuthApi.ts`.
     - This will wrap `fetch` calls (using the shared `apiClient.ts`) to the new `/auth/*` endpoints on your Worker.
     - Methods: `register()`, `login()`, `refresh()`, `logout()`, `resetPassword()`, `updatePassword()`, etc.
   - **DONE (initial):** `supabaseAuthClient.ts` and `OAuth.tsx` removed.
   - **PENDING:** Update `apps/mobile/src/features/auth/stores/authStore.ts`:
     - Adjust state and actions to work with the new API response shapes (e.g., `session.expires_at`).
     - `refreshSession()` should now call `workersAuthApi.refresh()`.
     - `checkInitialSession()` needs to validate the stored token, potentially by making a call to a protected endpoint or a dedicated `/auth/me` endpoint (to be created if needed).
   - **PENDING:** Update `apps/mobile/src/features/auth/hooks/useAuth.ts` React Query hooks to use `workersAuthApi.ts`.
   - **PENDING:** Update auth-related screens/components to use the new hooks and store logic.

## Key Considerations (Reiteration & Status)
- **Password hashing performance**: **DONE** (PBKDF2 Web Crypto, iterations can be tuned).
- **KV eventual consistency**: **Using KV**. For refresh/reset tokens, eventual consistency is generally acceptable. If stronger consistency is needed for other features (e.g., precise rate-limits not handled by CF's own service), Durable Objects could be an alternative.
- **Rate-limiting**: **PARTIALLY DONE** (Hono middleware in place, ensure it covers all sensitive auth endpoints).
- **Error handling**: **IMPROVING** (Standardized error responses are being used).
- **Secrets management**: **IN PROGRESS** (`JWT_SECRET` setup, email/SMS API keys pending).

## Simplifying Your Mobile Auth Layer
- Use one `apiClient.ts` for generic requests and token handling.
- Create `workersAuthApi.ts` with methods: `register()`, `verifyEmail()`, `login()`, `refresh()`, `logout()`, `resetPassword()`, `updatePassword()`, `sendOtp()`, `verifyOtp()`.
- Maintain a single Zustand store (`authStore.ts`) with state `{ user, session, stage, status }` and actions `setAuthData()`, `clearAuth()`, `refreshSession()`, `checkInitialSession()`.
- Keep `useAuth.ts` for React Query hooks (`useLogin`, `useRegister`, etc.) that call `workersAuthApi` and update the store.
- Retain only the screens/components you need (Login, Signup, ForgotPassword, etc.) and remove all Supabase-specific auth files.