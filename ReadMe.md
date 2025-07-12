# Capture: Privacy-First Social Media Platform

**© 2024 Obscura Technologies LLC. All rights reserved.**

> **IMPORTANT**: This software is proprietary and confidential. Unauthorized copying, distribution, modification, or use of this software, via any medium, is strictly prohibited without explicit written permission from the copyright holder.

<div align="center">
  <img src="apps/mobile/assets/CaptureLogo.png" alt="Capture Logo" width="120" height="120" style="border-radius: 20px;">
  <p><em>Reimagining social media with privacy as the foundation</em></p>
</div>

## Project Overview

Capture is a full-stack mobile application that reimagines social media by prioritizing user privacy, safety, and mental wellbeing. This project demonstrates implementation of modern mobile and backend development practices using React Native, TypeScript, and serverless architecture.

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
│   ├── components/    # Reusable UI components
│   ├── screens/       # Application screens
│   ├── stores/        # State management
│   ├── services/      # API integrations
│   ├── lib/           # Utilities and helpers
│   └── App.tsx        # Application entry point
└── ...
```

### Backend (Cloudflare Workers + Hono + Rust WASM)

```
apps/server/
├── src/
│   ├── index.ts           # Hono app entry point with Workers integration
│   ├── graphql/           # GraphQL schema and resolvers (Apollo Server)
│   ├── routes/            # REST API endpoints (auth, media, cache, etc.)
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

The app is in active development with the following components implemented:

### Mobile App (React Native + Expo)
- **Authentication**: Complete passkey, Apple, and Google Sign-In
- **Core Features**: Feed, posts, profiles, comments, search
- **UI/UX**: Modern design with animations and smooth interactions
- **Biometric Security**: Face ID/Touch ID integration
- **Performance**: Optimized with React Query caching and Flash List

### Server Infrastructure (Cloudflare Workers)
- **API**: GraphQL and REST endpoints fully operational
- **Database**: SQLite D1 with Drizzle ORM for relational data
- **Storage**: R2 object storage with CDN for media files
- **Authentication**: JWT + passkey system with session management
- **Performance**: Edge computing with WASM modules for image processing
- **AI**: Vector embeddings for content discovery and search

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
# Clone the repository
git clone https://github.com/Jai-Dhiman/capture.git
cd capture

# Install dependencies
pnpm install

# Build WASM modules (required for server)
cd apps/server
pnpm run build:wasm
cd ../..

# Development commands
pnpm dev              # Start both mobile and server in development
# OR individually:
cd apps/mobile && pnpm dev     # Mobile app only (Expo dev server)
cd apps/server && pnpm dev     # Server only (Wrangler dev)
```

### Environment Setup

**Mobile App:**
- Copy `apps/mobile/.env.example` to `apps/mobile/.env`
- Configure Google Sign-In and Apple authentication keys

**Server:**
- Set up Cloudflare Workers environment variables
- Configure D1 database with `pnpm db:migrate`
- Set up R2 bucket for image storage

## Project Status

**Current State:** Functional MVP with core social media features implemented across both mobile and server components.

**Deployment:**
- **Mobile**: Expo development builds for iOS and Android
- **Server**: Live on Cloudflare Workers at `capture-api.jai-d.workers.dev`
- **Database**: Production SQLite D1 database with migrations
- **Storage**: R2 object storage with CDN integration

This project demonstrates modern full-stack development practices and serves as a portfolio showcase. It may evolve into a closed-source product in the future.

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
