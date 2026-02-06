# Capture: Privacy-First Social Media Platform

**© 2024 Obscura Technologies LLC. All rights reserved.**

> **IMPORTANT**: This software is proprietary and confidential. Unauthorized copying, distribution, modification, or use of this software, via any medium, is strictly prohibited without explicit written permission from the copyright holder.

<div align="center">
  <img src="apps/mobile/assets/CaptureLogo.png" alt="Capture Logo" width="120" height="120" style="border-radius: 20px;">
  <p><em>Reimagining social media with privacy as the foundation</em></p>
</div>

## Overview

Capture is a full-stack social media platform in pre-beta development. It pairs a React Native mobile app with a Cloudflare Workers edge backend, prioritizing user privacy and a clean, algorithm-free experience.

## Core Principles

- **Privacy by Design**: No invasive tracking or data harvesting
- **User Control**: Chronological feeds, content filtering, and customizable experience
- **Simplified Experience**: Clean interface focusing on meaningful connections
- **Mental Wellbeing**: Removing addictive algorithms and harmful content

## Architecture

### Frontend (React Native + Expo)

```
apps/mobile/src/
├── features/         # auth, feed, post, profile, comments, search, settings
├── shared/           # Shared components and utilities
├── navigation/       # Navigation configuration
└── App.tsx
```

### Backend (Cloudflare Workers + Hono + Rust WASM)

```
apps/server/
├── src/
│   ├── graphql/      # GraphQL schema and resolvers (Apollo Server)
│   ├── routes/       # REST endpoints (auth, media, analytics)
│   ├── middleware/    # Auth, security, rate limiting
│   ├── db/           # Drizzle ORM schema and queries
│   └── lib/          # Auth, image processing, AI, caching, WASM integration
├── wasm-src/         # Rust source for WASM modules
└── drizzle/          # Database migrations
```

### Dashboard (SvelteKit)

```
apps/dashboard/src/
├── routes/           # Dashboard pages and analytics
└── lib/              # Utilities, API clients, components
```

## Tech Stack

| Category | Technologies |
|---|---|
| **Mobile** | React Native, Expo, TypeScript, TanStack Query, Zustand, Jotai, NativeWind |
| **Server** | Cloudflare Workers, Hono, Apollo Server (GraphQL), Drizzle ORM, Rust + WASM |
| **Data** | SQLite (D1), R2 Object Storage, Qdrant (vector search), KV |
| **Dashboard** | SvelteKit, Svelte 5, TailwindCSS, shadcn-svelte |
| **DevOps** | Turborepo, pnpm, GitHub Actions, Wrangler, Biome, Vitest, Sentry |

## Running the Project

### Prerequisites

- Node.js v20+
- pnpm 9.0.0+
- Expo CLI
- Rust (latest stable) + wasm-pack
- Wrangler CLI
- Cloudflare account with D1, R2, and KV storage

### Setup

```bash
# Clone the repository (if authorized)
git clone https://github.com/Jai-Dhiman/capture.git
cd capture

# Install dependencies
pnpm install

# Build WASM modules (required for server)
cd apps/server
pnpm run build:wasm
cd ../..

# Development commands
pnpm dev              # Start all apps (mobile, server, dashboard)
# OR individually:
cd apps/mobile && pnpm dev      # Mobile app (Expo dev server)
cd apps/server && pnpm dev      # Server (Wrangler dev)
cd apps/dashboard && pnpm dev   # Dashboard (SvelteKit dev)
```

### Environment Setup

- **Mobile**: Copy `apps/mobile/.env.example` to `.env`, configure OAuth keys
- **Server**: Set up Cloudflare Workers env vars, run `pnpm db:migrate`, configure R2 and Qdrant
- **Dashboard**: Copy environment configuration for API access

## Status

**Phase**: Pre-beta (no public users yet)

Implemented features span auth (passkeys, Apple/Google Sign-In, MFA, biometrics), social features (feeds, posts, comments, likes, saves, follows, blocking, search, hashtags), image processing via Rust WASM, AI-powered content discovery via Qdrant, and an analytics dashboard.

**Deployment**: Mobile on Expo dev builds (iOS/Android), server live on Cloudflare Workers, D1 + R2 in production, SvelteKit dashboard operational.

---

## Legal Notice

This project and all associated code, documentation, and assets are the exclusive property of Obscura Technologies LLC. This repository is made available for portfolio and demonstration purposes only.

**Usage Restrictions:**

- No commercial use permitted without written authorization
- No redistribution or modification allowed
- Viewing for educational/portfolio purposes only
- Any use requires explicit permission from the copyright holder

**Contact:** <capture@obscuratechnologies.com> for licensing inquiries.

---

<div align="center">
  <p><strong>© 2024 Obscura Technologies LLC. All rights reserved.</strong></p>
</div>
