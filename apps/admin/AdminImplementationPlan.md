# Capture Admin Dashboard: Implementation Plan

## Introduction

This document outlines the implementation plan for the Capture admin dashboard, a dedicated monitoring and management interface for the platform's administrators. The dashboard will be integrated into our existing monorepo structure while maintaining strict security standards and providing critical analytics capabilities.

## Architecture Overview

We have decided on a hybrid architecture approach that combines the strengths of both full-stack SvelteKit with Cloudflare Workers and API-based data retrieval methods:

- **Full-Stack Direct Database Access**: Used for critical system monitoring, security operations, and functions requiring immediate data consistency.

- **API-Based Access**: Used for most analytics views and reporting functions, leveraging existing endpoints from the main application.

This balanced approach optimizes for both security and development efficiency, ensuring sensitive operations have direct access while reusing existing API endpoints where appropriate.

## Primary Analytics Features

### Phase 1: Core Monitoring

1. **Database Health Check**
   - **Architecture**: Full-stack with direct D1 access
   - **Implementation**: Create a dedicated endpoint that performs a simple query to test database connectivity and response time
   - **UI Components**: Health status card with real-time monitoring and manual refresh capability
   - **Justification**: Real-time system health requires direct database access for accurate assessment

2. **Daily/Monthly Active User Tracking**
   - **Architecture**: API-based
   - **Implementation**: Query existing user authentication logs with date filtering
   - **UI Components**: Line chart showing DAU/MAU trends, comparison metrics with previous periods
   - **Justification**: Historical data aggregation is well-suited for API access

### Phase 2: User Analytics

3. **New Follows/Blocks Count Tracking**
   - **Architecture**: API-based
   - **Implementation**: Create new API endpoint aggregating relationship and blocked_user table data
   - **UI Components**: Time-series charts showing follows and blocks over time with growth indicators
   - **Justification**: Trend analysis benefits from pre-processed data via API

4. **Private/Public Account Distribution**
   - **Architecture**: API-based with scheduled updates
   - **Implementation**: Query profile table for isPrivate flag distribution
   - **UI Components**: Pie chart showing distribution, percentage metrics, trend indicators
   - **Justification**: This aggregate data doesn't require real-time accuracy

### Phase 3: Content Analytics

5. **Post/Thread Upload Analytics**
   - **Architecture**: API-based
   - **Implementation**: Query post table with type filtering
   - **UI Components**: Bar charts showing distribution, percentage breakdown, time-series trend analysis
   - **Justification**: Historical posting patterns are best aggregated via API

6. **Average Comment Length**
   - **Architecture**: Full-stack with direct D1 access
   - **Implementation**: SQL query with length calculations on comment content
   - **UI Components**: Numeric display with trend indicators, distribution chart
   - **Justification**: This calculation benefits from SQL functions available through direct database access

## Authentication and Security

We will implement enhanced security measures specifically for the admin dashboard:

- **Authentication**: Extend Supabase implementation with specific admin role
- **Access Control**: Implement Cloudflare Access IP allowlisting for admin domain
- **Session Management**: Configure shorter token lifetimes for admin sessions
- **Audit Logging**: Create comprehensive logging of all admin actions with user attribution

## Development Workflow

1. Initial setup in monorepo structure (apps/admin)
2. Configuration of SvelteKit with Cloudflare adapter
3. Implementation of shadcn-svelte UI components
4. Feature development according to phased approach
5. Comprehensive testing with production data
6. Deployment as separate application with dedicated security rules

## Future Analytics Enhancements

The following analytics features are planned for future phases:

- Content moderation effectiveness metrics
- User growth cohort analysis
- Engagement depth metrics
- Retention analysis
- Hashtag performance analytics
- Referral source effectiveness
- Performance monitoring and optimization tools

## Technical Stack Details

- **Frontend**: SvelteKit 5, TypeScript, Tailwind CSS, shadcn-svelte
- **Backend**: Cloudflare Workers, D1 database (direct and via API)
- **Authentication**: Supabase with enhanced security measures
- **Deployment**: Cloudflare Pages with environment-specific configurations
- **Monitoring**: Sentry integration for error tracking

This phased approach ensures we can deliver critical monitoring capabilities quickly while building toward a comprehensive admin solution that maintains the privacy-first principles of the Capture platform.