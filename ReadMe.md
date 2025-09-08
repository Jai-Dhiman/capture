# Capture: Privacy-First Social Media Platform

**© 2024 Obscura Technologies LLC. All rights reserved.**

> **IMPORTANT**: This software is proprietary and confidential. Unauthorized copying, distribution, modification, or use of this software, via any medium, is strictly prohibited without explicit written permission from the copyright holder.

<div align="center">
  <img src="apps/mobile/assets/CaptureLogo.png" alt="Capture Logo" width="120" height="120" style="border-radius: 20px;">
  <p><em>Reimagining social media with privacy as the foundation</em></p>
</div>

## Project Overview

Capture is a full-stack social media application currently in pre-beta development. The project demonstrates modern mobile and backend development practices, implementing a complete privacy-focused social platform using React Native, TypeScript, and edge computing architecture.

### Core Technical Challenges Addressed
    
- Building a responsive, performant cross-platform mobile UI with React Native and Expo
- Implementing secure user authentication with passkeys and end-to-end encryption
- Designing a scalable GraphQL API with Apollo Server on Cloudflare Workers
- Creating a high-performance edge computing backend with Hono framework and Rust WASM modules
- Implementing advanced image processing and AI-powered content discovery
- Establishing a robust CI/CD pipeline with automated testing and edge deployment

## Core Principles

- **Privacy by Design**: No invasive tracking or data harvesting
- **User Control**: Chronological feeds, content filtering, and customizable experience
- **Simplified Experience**: Clean interface focusing on meaningful connections
- **Mental Wellbeing**: Removing addictive algorithms and harmful content

## Architecture

### Frontend (React Native + Expo)

```
apps/mobile/
├── src/
│   ├── features/         # Feature-based organization
│   │   ├── auth/         # Authentication (passkeys, OAuth, MFA)
│   │   ├── feed/         # Home and discovery feeds
│   │   ├── post/         # Post creation and management
│   │   ├── profile/      # User profiles and relationships
│   │   ├── comments/     # Comment system
│   │   ├── search/       # Search functionality
│   │   └── settings/     # App settings and preferences
│   ├── shared/           # Shared components and utilities
│   ├── navigation/       # Navigation configuration
│   └── App.tsx          # Application entry point
└── ...
```

### Backend (Cloudflare Workers + Hono + Rust WASM)

```
apps/server/
├── src/
│   ├── index.ts           # Hono app entry point with Workers integration
│   ├── graphql/           # GraphQL schema and resolvers (Apollo Server)
│   ├── routes/            # REST API endpoints (auth, media, analytics)
│   ├── middleware/        # Authentication, security, rate limiting
│   ├── db/               # Drizzle ORM schema and database queries
│   ├── lib/              # Core services and utilities
│   │   ├── auth/         # Authentication & passkey services
│   │   ├── images/       # Image processing and metadata services
│   │   ├── ai/           # AI embedding and ML services
│   │   ├── cache/        # Caching and performance services
│   │   ├── services/     # Email, notifications, etc.
│   │   ├── database/     # Database utilities and seeding
│   │   ├── infrastructure/ # Qdrant and external service clients
│   │   └── wasm/         # WASM Rust module integration
│   └── types/            # TypeScript type definitions
├── wasm-src/             # Rust source code for WASM modules
│   ├── src/              # Rust image processing and crypto libraries
│   ├── Cargo.toml        # Rust dependencies and WASM configuration
│   └── tests/            # Rust unit tests
├── wasm/                 # Compiled WASM output
└── drizzle/              # Database migrations and schema
```

### Dashboard (SvelteKit Analytics)

```
apps/dashboard/
├── src/
│   ├── routes/           # Dashboard pages and analytics
│   ├── lib/              # Dashboard utilities and API clients
│   │   └── components/   # Reusable Svelte components
│   └── app.html         # Dashboard entry point
└── ...
```



## Key Technologies

### Frontend

- **React Native & Expo**: Cross-platform mobile framework
- **TypeScript**: Type-safe JavaScript
- **TanStack Query**: Data fetching and caching
- **Zustand & Jotai**: State management
- **NativeWind/TailwindCSS**: Styling solution
- **React Navigation**: Navigation framework

### Backend

- **Cloudflare Workers**: Edge computing serverless platform
- **Hono**: Fast, lightweight web framework for Workers
- **TypeScript**: Type-safe server-side development
- **Apollo Server**: GraphQL server with schema-first approach
- **Drizzle ORM**: Type-safe SQL database toolkit
- **Rust + WebAssembly**: High-performance compute modules for image processing
- **SQLite (D1)**: Cloudflare's distributed serverless SQL database
- **R2 Object Storage**: File and media storage with CDN integration
- **Qdrant**: Vector database for AI embeddings and search

### Dashboard & Analytics

- **SvelteKit**: Full-stack framework for the admin dashboard
- **Svelte 5**: Reactive UI framework with modern syntax
- **TailwindCSS**: Utility-first CSS framework
- **shadcn-svelte**: Pre-built UI components for Svelte

### DevOps & Infrastructure

- **Turborepo**: Monorepo build system with intelligent caching
- **pnpm**: Fast, disk-efficient package manager
- **GitHub Actions**: CI/CD automation pipeline
- **Wrangler**: Cloudflare Workers deployment and development CLI
- **Drizzle Kit**: Database migrations and schema management
- **Biome**: Fast linter and formatter for code consistency
- **Vitest**: Unit testing framework with coverage reporting
- **Cargo**: Rust package manager and build tool
- **wasm-pack**: Rust to WebAssembly compilation tool
- **Sentry**: Error tracking and performance monitoring


### Server Architecture Deep Dive

The backend leverages **Cloudflare Workers** for edge computing with a **Hono** web framework providing fast HTTP routing and middleware support. The architecture is designed for high performance and scalability:

#### API Layer

- **GraphQL API**: Apollo Server integration for complex data queries and real-time subscriptions
- **REST Endpoints**: Dedicated routes for authentication, media processing, caching, and profile management
- **Queue Processing**: Background job processing for post processing and AI embeddings

#### Middleware Stack

- **Authentication**: JWT-based auth with passkey support and session management
- **Security**: CORS, SSL redirects, security headers, and rate limiting
- **Error Handling**: Centralized error processing with Sentry integration
- **Logging**: Comprehensive request/response logging for monitoring

#### Service Architecture

- **Image Processing**: Rust WASM modules for high-performance image transformations, resizing, and optimization
- **AI Services**: Vector embeddings for content recommendation and semantic search
- **Caching Layer**: Multi-tier caching with edge optimization for media and API responses
- **Database Services**: Drizzle ORM with SQLite D1 for relational data and privacy filtering
- **External Integrations**: Email services, notification systems, and OAuth providers

## Development Approach

This project employs modern development practices including:

- **Monorepo Architecture**: Using Turborepo for efficient build caching and dependency management
- **Type Safety**: Rust's ownership model and comprehensive TypeScript validations
- **Error Handling**: Robust error boundaries and Result types in Rust
- **Testing**: Automated test suites for critical functionality
- **Performance Optimization**: WebAssembly compilation, React Query caching, and minimal re-renders
- **Security**: End-to-end encryption for messages, memory-safe Rust backend

## Key Differentiators

1. No engagement-maximizing algorithms that promote addictive behavior
2. Complete user control over content consumption
3. Transparent data policies with minimal collection
4. Built with modern, scalable technologies

## Current Status

**Development Phase**: Pre-beta (No public users yet)

The application is a fully functional social media platform with comprehensive features implemented across all layers:

### Mobile App (React Native + Expo)
- **Authentication**: Complete passkey, Apple, and Google Sign-In with MFA
- **Core Social Features**: Following/discovery feeds, post creation with media
- **User Interactions**: Comments, likes, saves, user profiles, and relationships
- **Advanced Features**: Search, hashtags, blocking, notifications
- **Security**: Biometric authentication (Face ID/Touch ID) integration
- **Performance**: Optimized with TanStack Query caching, FlashList virtualization
- **State Management**: Zustand stores with Jotai atoms for fine-grained reactivity

### Server Infrastructure (Cloudflare Workers)
- **API Layer**: GraphQL (Apollo Server) + REST endpoints fully operational
- **Database**: SQLite D1 with Drizzle ORM, comprehensive schema with relationships
- **Storage**: R2 object storage with CDN integration for media files
- **Authentication**: JWT + WebAuthn passkey system with session management
- **Image Processing**: Rust WASM modules for high-performance transformations
- **AI Services**: Vector embeddings with Qdrant for content discovery
- **Analytics**: Real-time metrics collection and processing

### Admin Dashboard (SvelteKit)
- **Analytics**: User metrics, content statistics, growth tracking
- **Monitoring**: Real-time system health and performance dashboards
- **Management**: User administration and content moderation tools

## Running the Project

### Prerequisites

- Node.js v20+
- pnpm 9.0.0+ (Package manager)
- Expo CLI (Mobile development)
- Rust (latest stable) + wasm-pack (WebAssembly compilation)
- Wrangler CLI (Cloudflare Workers deployment)
- Cloudflare account with D1, R2, and KV storage

### Setup and Installation

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

**Mobile App:**
- Copy `apps/mobile/.env.example` to `apps/mobile/.env`
- Configure Google Sign-In and Apple authentication keys

**Server:**
- Set up Cloudflare Workers environment variables (JWT secrets, API keys)
- Configure D1 database with `pnpm db:migrate`
- Set up R2 bucket for image storage and CDN
- Configure Qdrant vector database for AI features

**Dashboard:**
- Copy environment configuration for API access
- Ensure server analytics endpoints are accessible

## Technical Achievements

This project demonstrates modern full-stack development practices including:

- **Full-stack Type Safety**: End-to-end TypeScript with shared types
- **Advanced Authentication**: WebAuthn passkeys with biometric fallbacks
- **Edge Computing**: Rust WASM modules for high-performance image processing
- **Modern State Management**: Reactive patterns with optimistic updates
- **Scalable Architecture**: Microservices-ready modular design
- **Real-time Features**: Live updates and notifications
- **Privacy-First Design**: Minimal data collection with user control

## Development Status

**Current State:** Complete, production-ready social media platform in pre-beta phase.

**Deployment Infrastructure:**
- **Mobile**: Expo development builds configured for iOS and Android
- **Server**: Live on Cloudflare Workers with global edge distribution
- **Database**: Production SQLite D1 with comprehensive migrations
- **Storage**: R2 object storage with CDN integration and image optimization
- **Analytics**: Real-time dashboard with SvelteKit frontend

**Next Steps:** Public beta launch preparation, user acquisition strategy, and scaling optimization.

---

## Legal Notice

This project and all associated code, documentation, and assets are the exclusive property of Obscura Technologies LLC. This repository is made available for portfolio and demonstration purposes only.

**Usage Restrictions:**
- No commercial use permitted without written authorization
- No redistribution or modification allowed
- Viewing for educational/portfolio purposes only
- Any use requires explicit permission from the copyright holder

**Contact:** capture@obscuratechnologies.com for licensing inquiries.

---

<div align="center">
  <p>Built with modern web technologies for a privacy-first digital experience</p>
  <p><strong>© 2024 Obscura Technologies LLC. All rights reserved.</strong></p>
</div>
