# Feedback Ticket System - Technical Architecture Plan

## Overview

This document outlines the comprehensive plan for implementing a feedback ticket system across our multi-platform application, enabling users to submit feedback from the mobile app and admins to respond via the dashboard.

## **Requirement Analysis**

The current project is a social media platform with:
- **Backend**: Cloudflare Workers with Hono framework, Drizzle ORM, SQLite (D1), GraphQL API
- **Mobile App**: React Native/Expo with Apollo Client, Jotai state management
- **Dashboard**: SvelteKit with Tailwind CSS
- **Current Features**: User authentication, posts, comments, media, notifications, relationships

## **Recommended Approach**

### **1. System Architecture Overview**

The feedback system will use a simple form submission approach with basic CRUD operations:

```
Mobile App → GraphQL API → Database → Admin Dashboard
     ↓             ↓            ↓            ↓
Feedback Form → Ticket Storage → Manual Refresh → Admin Interface
```

**Key Components:**
- **Mobile**: Simple feedback submission form integrated into settings
- **Server**: Basic GraphQL mutations/queries for tickets (no subscriptions)
- **Dashboard**: Admin interface for ticket management (admin-only access)
- **Database**: New tables for tickets, responses, categories

### **2. Database Schema Design**

Based on the existing schema patterns, here are the new tables needed:

```sql
-- Feedback ticket categories
CREATE TABLE feedback_category (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  is_active INTEGER DEFAULT 1 NOT NULL,
  priority_level INTEGER DEFAULT 1 NOT NULL, -- 1=low, 2=medium, 3=high
  created_at NUMERIC DEFAULT(datetime('now')) NOT NULL
);

-- Main feedback tickets table
CREATE TABLE feedback_ticket (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  category_id TEXT NOT NULL REFERENCES feedback_category(id),
  subject TEXT NOT NULL,
  description TEXT NOT NULL,
  priority TEXT DEFAULT 'medium' NOT NULL, -- low, medium, high, urgent
  status TEXT DEFAULT 'open' NOT NULL, -- open, in_progress, resolved, closed
  type TEXT DEFAULT 'feedback' NOT NULL, -- feedback, bug_report, feature_request, support
  app_version TEXT,
  device_info TEXT, -- JSON string with device details
  created_at NUMERIC DEFAULT(datetime('now')) NOT NULL,
  updated_at NUMERIC DEFAULT(datetime('now')) NOT NULL,
  resolved_at NUMERIC,
  assigned_admin_id TEXT, -- for future admin assignment feature
  
  -- Indexes for performance
  INDEX('feedback_user_idx', user_id),
  INDEX('feedback_status_idx', status),
  INDEX('feedback_category_idx', category_id),
  INDEX('feedback_priority_idx', priority),
  INDEX('feedback_created_idx', created_at),
  INDEX('feedback_user_status_idx', user_id, status, created_at)
);

-- Ticket responses/replies table
CREATE TABLE feedback_response (
  id TEXT PRIMARY KEY,
  ticket_id TEXT NOT NULL REFERENCES feedback_ticket(id),
  responder_id TEXT NOT NULL REFERENCES users(id),
  responder_type TEXT DEFAULT 'user' NOT NULL, -- user, admin, system
  message TEXT NOT NULL,
  is_internal INTEGER DEFAULT 0 NOT NULL, -- admin-only notes
  created_at NUMERIC DEFAULT(datetime('now')) NOT NULL,
  
  INDEX('response_ticket_idx', ticket_id),
  INDEX('response_time_idx', created_at),
  INDEX('response_responder_idx', responder_id)
);

-- Ticket attachments (reuse existing media table pattern)
CREATE TABLE feedback_attachment (
  id TEXT PRIMARY KEY,
  ticket_id TEXT NOT NULL REFERENCES feedback_ticket(id),
  media_id TEXT NOT NULL REFERENCES media(id),
  uploaded_by TEXT NOT NULL REFERENCES users(id),
  description TEXT,
  created_at NUMERIC DEFAULT(datetime('now')) NOT NULL,
  
  INDEX('attachment_ticket_idx', ticket_id),
  INDEX('attachment_media_idx', media_id)
);
```

### **3. API Endpoint Specifications**

#### **GraphQL Schema Extensions**

```graphql
# Add to existing schema.ts

type FeedbackTicket {
  id: ID!
  user: Profile!
  category: FeedbackCategory!
  subject: String!
  description: String!
  priority: TicketPriority!
  status: TicketStatus!
  type: TicketType!
  appVersion: String
  deviceInfo: DeviceInfo
  responses: [FeedbackResponse!]!
  attachments: [FeedbackAttachment!]!
  createdAt: String!
  updatedAt: String!
  resolvedAt: String
  responseCount: Int!
  lastResponseAt: String
}

type FeedbackCategory {
  id: ID!
  name: String!
  description: String
  isActive: Boolean!
  priorityLevel: Int!
  ticketCount: Int!
}

type FeedbackResponse {
  id: ID!
  ticket: FeedbackTicket!
  responder: Profile!
  responderType: ResponderType!
  message: String!
  isInternal: Boolean!
  createdAt: String!
}

type FeedbackAttachment {
  id: ID!
  ticket: FeedbackTicket!
  media: Media!
  uploadedBy: Profile!
  description: String
  createdAt: String!
}

type DeviceInfo {
  platform: String
  osVersion: String
  appVersion: String
  deviceModel: String
  screenSize: String
}

enum TicketPriority {
  LOW
  MEDIUM
  HIGH
  URGENT
}

enum TicketStatus {
  OPEN
  IN_PROGRESS
  RESOLVED
  CLOSED
}

enum TicketType {
  FEEDBACK
  BUG_REPORT
  FEATURE_REQUEST
  SUPPORT
}

enum ResponderType {
  USER
  ADMIN
  SYSTEM
}

# Queries
extend type Query {
  # User queries
  myTickets(status: TicketStatus, limit: Int = 10, offset: Int = 0): [FeedbackTicket!]!
  ticket(id: ID!): FeedbackTicket
  
  # Admin queries (dashboard is admin-only)
  adminTickets(
    status: TicketStatus,
    priority: TicketPriority,
    type: TicketType,
    categoryId: ID,
    limit: Int = 20,
    offset: Int = 0
  ): AdminTicketConnection!
  adminTicketStats: AdminTicketStats!
  feedbackCategories: [FeedbackCategory!]!
}

# Mutations
extend type Mutation {
  # User mutations
  createTicket(input: CreateTicketInput!): FeedbackTicket!
  addTicketResponse(ticketId: ID!, message: String!): FeedbackResponse!
  uploadTicketAttachment(input: TicketAttachmentInput!): FeedbackAttachment!
  
  # Admin mutations (dashboard is admin-only)
  updateTicketStatus(ticketId: ID!, status: TicketStatus!): FeedbackTicket!
  addAdminResponse(ticketId: ID!, message: String!, isInternal: Boolean = false): FeedbackResponse!
  createFeedbackCategory(input: CategoryInput!): FeedbackCategory!
  updateFeedbackCategory(id: ID!, input: CategoryInput!): FeedbackCategory!
}


# Input types
input CreateTicketInput {
  categoryId: ID!
  subject: String!
  description: String!
  priority: TicketPriority = MEDIUM
  type: TicketType = FEEDBACK
  deviceInfo: DeviceInfoInput
  attachmentIds: [ID!]
}

input DeviceInfoInput {
  platform: String
  osVersion: String
  appVersion: String
  deviceModel: String
  screenSize: String
}

input TicketAttachmentInput {
  ticketId: ID!
  mediaId: ID!
  description: String
}

input CategoryInput {
  name: String!
  description: String
  priorityLevel: Int = 1
  isActive: Boolean = true
}

type AdminTicketConnection {
  tickets: [FeedbackTicket!]!
  totalCount: Int!
  hasNextPage: Boolean!
  stats: AdminTicketStats!
}

type AdminTicketStats {
  total: Int!
  open: Int!
  inProgress: Int!
  resolved: Int!
  closed: Int!
  avgResponseTime: Float # in hours
  urgentCount: Int!
}
```

### **4. Component Breakdown**

#### **Mobile App Components**

```typescript
// apps/mobile/src/features/feedback/
├── components/
│   ├── FeedbackForm.tsx           # Main ticket creation form
│   ├── TicketList.tsx             # User's submitted tickets
│   ├── TicketItem.tsx             # Individual ticket card
│   ├── TicketDetail.tsx           # Ticket conversation view
│   ├── ResponseInput.tsx          # Reply to ticket
│   ├── CategoryPicker.tsx         # Category selection
│   ├── PrioritySelector.tsx       # Priority selection
│   ├── AttachmentUploader.tsx     # Image/file upload
│   └── DeviceInfoCapture.tsx      # Auto-capture device details
├── hooks/
│   ├── useFeedbackTickets.ts      # Ticket management
│   └── useTicketForm.ts           # Form state management
├── screens/
│   ├── FeedbackScreen.tsx         # Main feedback screen
│   ├── TicketDetailScreen.tsx     # Individual ticket view
│   └── CreateTicketScreen.tsx     # New ticket creation
├── types/
│   └── feedbackTypes.ts           # TypeScript definitions
└── utils/
    ├── deviceInfo.ts              # Device info collection
    └── feedbackUtils.ts           # Helper functions
```

#### **Dashboard Components (SvelteKit)**

```typescript
// apps/dashboard/src/lib/components/feedback/
├── TicketQueue.svelte             # Admin ticket dashboard
├── TicketCard.svelte              # Ticket summary card
├── TicketDetail.svelte            # Full ticket view
├── ResponseThread.svelte          # Conversation thread
├── TicketFilters.svelte           # Filtering/sorting
├── TicketStats.svelte             # Analytics/metrics
├── CategoryManager.svelte         # Category management
├── QuickActions.svelte            # Bulk actions
└── AdminResponseForm.svelte       # Admin reply form

// Dashboard routes
├── routes/feedback/
│   ├── +page.svelte               # Main feedback dashboard
│   ├── +layout.svelte             # Feedback layout
│   ├── tickets/
│   │   ├── +page.svelte           # Ticket list
│   │   └── [id]/
│   │       └── +page.svelte       # Individual ticket
│   ├── categories/
│   │   └── +page.svelte           # Category management
│   └── analytics/
│       └── +page.svelte           # Feedback analytics
```

#### **Server Components**

```typescript
// apps/server/src/graphql/resolvers/feedback.ts
// New resolver file for feedback operations

// apps/server/src/lib/services/
├── feedbackService.ts             # Core business logic
├── ticketNotificationService.ts   # Email/push notifications
└── feedbackAnalyticsService.ts    # Analytics and reporting
```

### **5. Data Flow Diagram Concept**

```
User Submits Feedback (Mobile)
        ↓
GraphQL Mutation (createTicket)
        ↓
Database Insert (feedback_ticket)
        ↓
Admin Views Tickets (Dashboard - Manual Refresh)
        ↓
Admin Responds (Dashboard)
        ↓
GraphQL Mutation (addAdminResponse)
        ↓
Database Insert (feedback_response)
        ↓
User Views Response (Mobile - Manual Refresh)
```

### **6. Implementation Roadmap**

#### **Phase 1: Core Infrastructure (Week 1)**
1. Database schema migration
2. GraphQL schema updates
3. Basic resolvers implementation

#### **Phase 2: Mobile Implementation (Week 2)**
1. Simple feedback form component
2. Basic ticket list view
3. GraphQL integration
4. Device info collection

#### **Phase 3: Admin Dashboard (Week 3)**
1. Basic admin ticket queue
2. Simple response interface
3. Category management
4. Basic filtering

#### **Phase 4: Polish & Testing (Week 4)**
1. UI/UX improvements
2. Basic testing
3. Documentation

### **7. Technical Considerations**

#### **Simple Form Submission**
- Basic GraphQL mutations for ticket creation
- Manual refresh for both mobile and dashboard
- No real-time features to reduce complexity

#### **Notifications (Future Enhancement)**
- Email notifications for admins (using existing emailService)
- Optional push notifications for mobile app responses

#### **Performance Optimizations**
- Basic pagination for ticket lists
- Efficient database indexes
- Simple caching for frequently accessed data

#### **Security & Privacy**
- Dashboard assumes admin-only access (no additional auth needed)
- Rate limiting for ticket creation
- Input validation and sanitization
- GDPR compliance for user data

#### **Scalability (Future Consideration)**
- Archive old resolved tickets
- Database optimization as needed

### **Alternative Options**

#### **Option A: Simple Implementation** (Selected)
- Basic form submission without real-time features
- Manual refresh for updates
- Simple admin management
- **Pros**: Quick to implement, low complexity, easy to maintain
- **Cons**: No real-time updates, manual refresh required

#### **Option B: Third-party Integration**
- Integrate with services like Zendesk, Intercom, or Freshdesk
- **Pros**: Feature-rich, proven solution
- **Cons**: Additional costs, data privacy concerns, limited customization

#### **Option C: Full-featured Custom Solution**
- Complete in-app ticket system with real-time features
- **Pros**: Full control, seamless integration, customizable
- **Cons**: Higher development effort, more maintenance, complex implementation

### **Risk Assessment**

#### **Potential Challenges**
1. **User expectations**: Users may expect real-time updates
2. **Admin workflow**: Manual refresh may be less efficient
3. **Database performance**: Efficient querying with growth
4. **Mobile UX**: Keeping the interface simple yet functional

#### **Mitigation Strategies**
1. Clear user communication about manual refresh
2. Efficient admin dashboard design
3. Database optimization and monitoring
4. Focus on simple, intuitive design

### **Next Steps**

1. **Confirm Requirements**: Validate the proposed feature set
2. **Database Migration**: Implement the schema changes
3. **API Development**: Create GraphQL resolvers
4. **Mobile Prototype**: Build basic feedback form
5. **Admin Interface**: Create initial dashboard

## **Conclusion**

This simplified design leverages the existing architecture while adding a basic feedback system that can be implemented quickly and maintained easily. The simple form submission approach reduces complexity while still providing essential functionality.

The selected simple implementation provides the best balance of quick delivery and essential features, with the option to enhance with real-time capabilities in the future if needed. The streamlined approach ensures rapid deployment and easy maintenance.