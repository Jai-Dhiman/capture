# Migration Context: Supabase Auth → Cloudflare Workers Auth

## Purpose & Scope
- Replace Supabase Auth with a Workers-based identity stack on Cloudflare.
- Consolidate relational data (users + profiles) into D1 and transient state (refresh tokens, one-time codes) into KV.
- Start from scratch—no user-migration required.

## Current vs Target Architecture

| Layer          | Today (Supabase)                                    | Tomorrow (Workers Auth)                                        |
|----------------|-----------------------------------------------------|----------------------------------------------------------------|
| HTTP server    | Hono → Supabase REST `/auth` & GraphQL              | Cloudflare Workers (Hono or native router) for `/auth`, `/api`, `/graphql` |
| Relational DB  | Supabase Postgres (users) + D1 (profiles)           | Single D1 DB with `users` + `profiles` tables                 |
| Tokens & OTP   | Supabase-managed JWTs, refresh tokens, SMS via Supabase | JWTs signed in Workers + refresh tokens in KV + OTP codes in KV |
| Client logic   | Supabase SDK + custom fetch wrappers + Zustand      | Custom `workersAuthApi` + shared `apiClient` + Zustand         |


## Step-by-Step Plan

1. Bind & configure Worker environment
   - Create KV namespaces
   - Add `JWT_SECRET` and provider credentials as Wrangler secrets.

2. Define D1 schema & migrations
   - Create a `users` table:
     - `id` (PK), `email` (unique), `password_hash`, `email_verified` (bool), `phone` (nullable), `created_at`, `updated_at`.
   - Write SQL migration files and apply with `wrangler d1 migrations apply`.

3. Reference the Workers-Auth boilerplate
   - Use the community "workers-auth" example as a guide—no need to rewrite it from scratch.
   - Implement routes:
     - `POST /register`, `GET /verify-email`, `POST /login`, `POST /refresh`, `POST /logout`,
       `POST /reset-password`, `POST /update-password`, (optionally) `POST /send-otp`, `POST /verify-otp`.
   - Leverage Web Crypto PBKDF2 API and JWT signing via `JWT_SECRET`.

4. Wire in Email & SMS providers
   - Call your email API from the Worker to send verification and reset links.
   - Call Twilio (or equivalent) for OTP SMS; store codes in KV with TTL for validation.

5. Integrate GraphQL / private APIs
   - Move existing Hono GraphQL handlers into the same Worker runtime.
   - Reuse the JWT auth middleware and the same D1 binding for protected endpoints.

6. Mobile client migration
   - Point `API_URL` at your Worker's domain.
   - Replace all Supabase SDK calls with a new `workersAuthApi.ts` wrapping your `/auth/*` endpoints.
   - Remove `supabaseAuthClient.ts` and PKCE boilerplate unless re-implementing OAuth.
   - Retain your session-persistence logic: store `{ access_token, refresh_token, expires_at }` in secureStorage.

## Key Considerations
- **Password hashing performance**: ensure hashing library runs within Workers' CPU limits.
- **KV eventual consistency**: consider Durable Objects if you need strong consistency (e.g., rate-limits, token revocation).
- **Rate-limiting**: use Cloudflare Rate Limits or a Durable Object counter for sensitive endpoints (`/login`, `/send-otp`).
- **Error handling**: standardize error shapes so the mobile app can uniformly parse codes/messages.
- **Secrets management**: keep all keys (JWT_SECRET, DB credentials, email/SMS API keys) in Wrangler secrets.

## Simplifying Your Mobile Auth Layer
- Use one `apiClient.ts` for generic requests and token handling.
- Create `workersAuthApi.ts` with methods: `register()`, `verifyEmail()`, `login()`, `refresh()`, `logout()`, `resetPassword()`, `updatePassword()`, `sendOtp()`, `verifyOtp()`.
- Maintain a single Zustand store (`authStore.ts`) with state `{ user, session, stage, status }` and actions `setAuthData()`, `clearAuth()`, `refreshSession()`, `checkInitialSession()`.
- Keep `useAuth.ts` for React Query hooks (`useLogin`, `useRegister`, etc.) that call `workersAuthApi` and update the store.
- Retain only the screens/components you need (Login, Signup, ForgotPassword, etc.) and remove all Supabase-specific auth files.
