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
- Implementing secure user authentication and data encryption
- Designing an efficient GraphQL API with custom Rust implementation
- Creating a high-performance serverless backend with Rust WebAssembly and Cloudflare Workers
- Establishing a robust CI/CD pipeline with automated testing

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

### Backend (Rust WebAssembly + Cloudflare Workers)

```
apps/server/
├── src/
│   ├── graphql/       # GraphQL schema and resolvers
│   ├── db/            # Database schema and queries
│   ├── routes/        # API routes
│   ├── middleware/    # Request processing middleware
│   └── lib.rs         # Server entry point
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

- **Rust**: Systems programming language compiled to WebAssembly
- **WebAssembly (wasm32-unknown-unknown)**: High-performance runtime for Cloudflare Workers
- **Cloudflare Workers**: Serverless computing platform
- **GraphQL**: API query language with custom Rust implementation
- **SQLite**: Serverless SQL database integration
- **Serde**: Serialization framework for Rust

### Security

- **Signal Protocol implementation**: End-to-end encrypted messaging
- **Rust cryptographic libraries**: High-performance cryptographic operations
- **Type safety**: Rust's ownership model and TypeScript validation

### DevOps

- **Turborepo**: Monorepo build system
- **pnpm**: Fast, disk-efficient package manager
- **GitHub Actions**: CI/CD automation
- **Cargo**: Rust package manager and build tool
- **wasm-pack**: WebAssembly build tool for Rust
- **Wrangler**: Cloudflare Workers CLI

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

## Development Priorities

1. MVP with core social features (profiles, posts, following)
2. Privacy and security infrastructure
3. User control features (feed customization, filtering)
4. Performance optimization for smooth experience

## Running the Project

### Prerequisites

- Node.js v20+
- pnpm 9.0.0+
- Expo CLI
- Rust (latest stable)
- wasm-pack
- Wrangler CLI (for Cloudflare Workers)

### Setup and Installation

```bash
# Clone the repository
git clone https://github.com/Jai-Dhiman/capture.git
cd capture

# Install dependencies
pnpm install

# Build the Rust WebAssembly backend
cd server
wasm-pack build --target bundler
cd ..

# Start the development environment
pnpm dev
```

## Project Status

This project is in active development. It is currently a portfolio demonstration and may eventually evolve into a closed-source product. The codebase represents my approach to tackling the technical challenges of modern application development.

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
