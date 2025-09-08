import { config } from './config';
import type { AdminTicketConnection, FeedbackCategory, AdminTicketStats, TicketFilters, FeedbackTicket } from './types';

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

export class GraphQLError extends Error {
  constructor(public errors: any[], message: string) {
    super(message);
    this.name = 'GraphQLError';
  }
}

export async function apiRequest(
  endpoint: string, 
  options: RequestInit = {}
): Promise<any> {
  const url = `${config.apiUrl}${endpoint}`;
  
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });

  if (!response.ok) {
    throw new ApiError(response.status, `API request failed: ${response.statusText}`);
  }

  return response.json();
}

export async function graphqlRequest(
  query: string, 
  variables: Record<string, any> = {}
): Promise<any> {
  const response = await fetch(`${config.apiUrl}/graphql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Origin': typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000',
    },
    body: JSON.stringify({
      query,
      variables,
    }),
  });

  if (!response.ok) {
    throw new ApiError(response.status, `GraphQL request failed: ${response.statusText}`);
  }

  const result = await response.json();
  
  if (result.errors) {
    throw new GraphQLError(result.errors, 'GraphQL query returned errors');
  }

  return result.data;
}

export const api = {
  // Health check endpoint (root path)
  health: () => apiRequest('/'),
  
  // Analytics endpoints
  analytics: {
    overview: () => apiRequest('/api/analytics/overview'),
    userGrowth: () => apiRequest('/api/analytics/user-growth'),
    contentActivity: () => apiRequest('/api/analytics/content-activity'),
    topUsers: () => apiRequest('/api/analytics/top-users'),
    recentActivity: () => apiRequest('/api/analytics/recent-activity'),
  },

  // Feedback/Support tickets
  feedback: {
    getAdminTickets: (filters: TicketFilters & { limit?: number; offset?: number } = {}) => 
      graphqlRequest(`
        query AdminTickets($status: TicketStatus, $priority: TicketPriority, $type: TicketType, $categoryId: ID, $limit: Int, $offset: Int) {
          adminTickets(status: $status, priority: $priority, type: $type, categoryId: $categoryId, limit: $limit, offset: $offset) {
            tickets {
              id
              subject
              description
              priority
              status
              type
              appVersion
              deviceInfo {
                platform
                osVersion
                appVersion
                deviceModel
                screenSize
              }
              createdAt
              updatedAt
              resolvedAt
              responseCount
              lastResponseAt
              user {
                id
                userId
                username
                profileImage
                verifiedType
              }
              category {
                id
                name
                description
              }
            }
            totalCount
            hasNextPage
            stats {
              total
              open
              inProgress
              resolved
              closed
              urgentCount
              avgResponseTime
            }
          }
        }
      `, filters),

    getTicket: (id: string) =>
      graphqlRequest(`
        query GetTicket($id: ID!) {
          ticket(id: $id) {
            id
            subject
            description
            priority
            status
            type
            appVersion
            deviceInfo {
              platform
              osVersion
              appVersion
              deviceModel
              screenSize
            }
            createdAt
            updatedAt
            resolvedAt
            responseCount
            lastResponseAt
            user {
              id
              userId
              username
              profileImage
              verifiedType
            }
            category {
              id
              name
              description
            }
            responses {
              id
              message
              responderType
              isInternal
              createdAt
              responder {
                id
                username
                profileImage
              }
            }
            attachments {
              id
              description
              createdAt
              media {
                id
                type
                storageKey
              }
              uploadedBy {
                id
                username
              }
            }
          }
        }
      `, { id }),

    getCategories: () =>
      graphqlRequest(`
        query FeedbackCategories {
          feedbackCategories {
            id
            name
            description
            isActive
            priorityLevel
            ticketCount
            createdAt
          }
        }
      `),

    getStats: () =>
      graphqlRequest(`
        query AdminTicketStats {
          adminTicketStats {
            total
            open
            inProgress
            resolved
            closed
            urgentCount
            avgResponseTime
          }
        }
      `),

    updateTicketStatus: (ticketId: string, status: string) =>
      graphqlRequest(`
        mutation UpdateTicketStatus($ticketId: ID!, $status: TicketStatus!) {
          updateTicketStatus(ticketId: $ticketId, status: $status) {
            id
            status
            updatedAt
            resolvedAt
          }
        }
      `, { ticketId, status }),

    addAdminResponse: (ticketId: string, message: string, isInternal: boolean = false) =>
      graphqlRequest(`
        mutation AddAdminResponse($ticketId: ID!, $message: String!, $isInternal: Boolean) {
          addAdminResponse(ticketId: $ticketId, message: $message, isInternal: $isInternal) {
            id
            message
            responderType
            isInternal
            createdAt
            responder {
              id
              username
              profileImage
            }
          }
        }
      `, { ticketId, message, isInternal }),
  },
}; 