# Capture: Privacy-First Social Media Platform

## Project Vision
Capture reimagines social media by prioritizing user privacy, safety, and mental wellbeing without sacrificing the engaging features users love. I'm building an alternative to algorithm-driven platforms that compromise user data and psychological health.

## Core Principles
- **Privacy by Design**: No invasive tracking or data harvesting
- **User Control**: Chronological feeds, content filtering, and customizable experience
- **Simplified Experience**: Clean interface focusing on meaningful connections
- **Mental Wellbeing**: Removing addictive algorithms and harmful content

## Technical Architecture

### Frontend
- React Native + Expo for cross-platform mobile development
- TypeScript for type safety
- Tanstack/React Query for data fetching
- Zustand and Jotai for state management
- NativeWind/Tailwind for Styling

### Backend/Infrastructure
- Cloudflare Workers ecosystem:
  - Hono for API framework
  - Drizzle ORM with D1 SQLite for database operations
  - R2 for media storage
  - Durable Objects for real-time features
  - KV for caching
  - Workers AI for content moderation
  - Vectorize for content recommendations without invasive tracking

### Security & Privacy Features
- Signal Protocol implementation for end-to-end encrypted messaging
- TweetNaCl.js for cryptographic operations
- Zod for runtime type validation and request sanitization

### DevOps & Tooling
- pnpm for package management
- Turborepo for monorepo management
- Vitest for testing
- GitHub Actions for CI/CD
- Wrangler for Cloudflare Workers development

### Key Differentiators
1. No engagement-maximizing algorithms that promote addictive behavior
2. Complete user control over content consumption
3. Transparent data policies with minimal collection
4. Built with modern, scalable technologies

## Development Priorities
1. MVP with core social features (profiles, posts, following)
2. Privacy and security infrastructure
3. User control features (feed customization, filtering)
4. Performance optimization for smooth experience