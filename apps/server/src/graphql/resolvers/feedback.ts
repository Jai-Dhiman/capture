import { desc, eq, sql, and, inArray } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { createD1Client } from '../../db';
import * as schema from '../../db/schema';
import { createCachingService, CacheKeys, CacheTTL } from '../../lib/cache/cachingService';
import type { ContextType } from '../../types';

// Helper functions to convert database values to GraphQL enum values
function mapStatus(dbStatus: string): string {
  const statusMap: Record<string, string> = {
    'open': 'OPEN',
    'in_progress': 'IN_PROGRESS',
    'resolved': 'RESOLVED',
    'closed': 'CLOSED',
  };
  return statusMap[dbStatus] || dbStatus;
}

function mapPriority(dbPriority: string): string {
  const priorityMap: Record<string, string> = {
    'low': 'LOW',
    'medium': 'MEDIUM', 
    'high': 'HIGH',
    'urgent': 'URGENT',
  };
  return priorityMap[dbPriority] || dbPriority;
}

function mapType(dbType: string): string {
  const typeMap: Record<string, string> = {
    'feedback': 'FEEDBACK',
    'bug_report': 'BUG_REPORT',
    'feature_request': 'FEATURE_REQUEST',
    'support': 'SUPPORT',
  };
  return typeMap[dbType] || dbType;
}

export const feedbackResolvers = {
  Query: {
    async myTickets(
      _parent: unknown,
      { status, limit = 10, offset = 0 }: { status?: string; limit?: number; offset?: number },
      context: ContextType,
    ) {
      if (!context.user) {
        throw new Error('Authentication required');
      }

      try {
        const db = createD1Client(context.env);

        let whereConditions = [eq(schema.feedbackTicket.userId, context.user.id)];
        if (status) {
          whereConditions.push(eq(schema.feedbackTicket.status, status));
        }

        const tickets = await db
          .select()
          .from(schema.feedbackTicket)
          .where(and(...whereConditions))
          .orderBy(desc(schema.feedbackTicket.createdAt))
          .limit(limit)
          .offset(offset)
          .all();

        return Promise.all(
          tickets.map(async (ticket) => {
            const [user, category, responses] = await Promise.all([
              db
                .select()
                .from(schema.profile)
                .where(eq(schema.profile.userId, ticket.userId))
                .get(),
              db
                .select()
                .from(schema.feedbackCategory)
                .where(eq(schema.feedbackCategory.id, ticket.categoryId))
                .get(),
              db
                .select()
                .from(schema.feedbackResponse)
                .where(eq(schema.feedbackResponse.ticketId, ticket.id))
                .orderBy(desc(schema.feedbackResponse.createdAt))
                .all(),
            ]);

            return {
              ...ticket,
              status: mapStatus(ticket.status),
              priority: mapPriority(ticket.priority),
              type: mapType(ticket.type),
              user,
              category,
              responses: responses || [],
              responseCount: responses?.length || 0,
              lastResponseAt: responses?.[0]?.createdAt || null,
              deviceInfo: ticket.deviceInfo ? JSON.parse(ticket.deviceInfo) : null,
            };
          }),
        );
      } catch (error) {
        console.error('Error fetching user tickets:', error);
        throw new Error(
          `Failed to fetch tickets: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }
    },

    async ticket(_parent: unknown, { id }: { id: string }, context: ContextType) {
      // TEMPORARY: Allow unauthenticated access for admin dashboard testing
      // TODO: Implement proper admin authentication and authorization
      // if (!context.user) {
      //   throw new Error('Authentication required');
      // }

      try {
        const db = createD1Client(context.env);
        const ticket = await db
          .select()
          .from(schema.feedbackTicket)
          .where(eq(schema.feedbackTicket.id, id))
          .get();

        if (!ticket) {
          throw new Error('Ticket not found');
        }

        // TEMPORARY: Skip authorization check for admin dashboard testing
        // TODO: Add proper role-based access control
        // if (ticket.userId !== context.user.id) {
        //   throw new Error('Not authorized to access this ticket');
        // }

        const [user, category, responses, attachments] = await Promise.all([
          db
            .select()
            .from(schema.profile)
            .where(eq(schema.profile.userId, ticket.userId))
            .get(),
          db
            .select()
            .from(schema.feedbackCategory)
            .where(eq(schema.feedbackCategory.id, ticket.categoryId))
            .get(),
          db
            .select()
            .from(schema.feedbackResponse)
            .where(eq(schema.feedbackResponse.ticketId, ticket.id))
            .orderBy(desc(schema.feedbackResponse.createdAt))
            .all(),
          db
            .select()
            .from(schema.feedbackAttachment)
            .where(eq(schema.feedbackAttachment.ticketId, ticket.id))
            .all(),
        ]);

        return {
          ...ticket,
          status: mapStatus(ticket.status),
          priority: mapPriority(ticket.priority),
          type: mapType(ticket.type),
          user,
          category,
          responses: responses || [],
          attachments: attachments || [],
          responseCount: responses?.length || 0,
          lastResponseAt: responses?.[0]?.createdAt || null,
          deviceInfo: ticket.deviceInfo ? JSON.parse(ticket.deviceInfo) : null,
        };
      } catch (error) {
        console.error('Error fetching ticket:', error);
        throw new Error(
          `Failed to fetch ticket: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }
    },

    async adminTickets(
      _parent: unknown,
      {
        status,
        priority,
        type,
        categoryId,
        limit = 20,
        offset = 0,
      }: {
        status?: string;
        priority?: string;
        type?: string;
        categoryId?: string;
        limit?: number;
        offset?: number;
      },
      context: ContextType,
    ) {
      // TEMPORARY: Allow unauthenticated access for admin dashboard testing
      // TODO: Implement proper admin authentication
      // if (!context.user) {
      //   throw new Error('Authentication required');
      // }

      try {
        const db = createD1Client(context.env);

        let whereConditions = [];
        if (status) whereConditions.push(eq(schema.feedbackTicket.status, status));
        if (priority) whereConditions.push(eq(schema.feedbackTicket.priority, priority));
        if (type) whereConditions.push(eq(schema.feedbackTicket.type, type));
        if (categoryId) whereConditions.push(eq(schema.feedbackTicket.categoryId, categoryId));

        const tickets = await db
          .select()
          .from(schema.feedbackTicket)
          .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
          .orderBy(desc(schema.feedbackTicket.createdAt))
          .limit(limit)
          .offset(offset)
          .all();

        const totalCount = await db
          .select({ count: sql<number>`count(*)` })
          .from(schema.feedbackTicket)
          .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
          .get();

        const stats = await getAdminTicketStats(db);

        const enhancedTickets = await Promise.all(
          tickets.map(async (ticket) => {
            const [user, category, responses] = await Promise.all([
              db
                .select()
                .from(schema.profile)
                .where(eq(schema.profile.userId, ticket.userId))
                .get(),
              db
                .select()
                .from(schema.feedbackCategory)
                .where(eq(schema.feedbackCategory.id, ticket.categoryId))
                .get(),
              db
                .select()
                .from(schema.feedbackResponse)
                .where(eq(schema.feedbackResponse.ticketId, ticket.id))
                .orderBy(desc(schema.feedbackResponse.createdAt))
                .all(),
            ]);

            return {
              ...ticket,
              status: mapStatus(ticket.status),
              priority: mapPriority(ticket.priority),
              type: mapType(ticket.type),
              user,
              category,
              responses: responses || [],
              responseCount: responses?.length || 0,
              lastResponseAt: responses?.[0]?.createdAt || null,
              deviceInfo: ticket.deviceInfo ? JSON.parse(ticket.deviceInfo) : null,
            };
          }),
        );

        return {
          tickets: enhancedTickets,
          totalCount: totalCount?.count || 0,
          hasNextPage: offset + limit < (totalCount?.count || 0),
          stats,
        };
      } catch (error) {
        console.error('Error fetching admin tickets:', error);
        throw new Error(
          `Failed to fetch admin tickets: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }
    },

    async adminTicketStats(_parent: unknown, _args: unknown, context: ContextType) {
      // TEMPORARY: Allow unauthenticated access for admin dashboard testing
      // TODO: Implement proper admin authentication
      // if (!context.user) {
      //   throw new Error('Authentication required');
      // }

      try {
        const db = createD1Client(context.env);
        return await getAdminTicketStats(db);
      } catch (error) {
        console.error('Error fetching admin ticket stats:', error);
        throw new Error(
          `Failed to fetch ticket stats: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }
    },

    async feedbackCategories(_parent: unknown, _args: unknown, context: ContextType) {
      // TEMPORARY: Allow unauthenticated access for admin dashboard testing
      // TODO: Implement proper admin authentication
      // if (!context.user) {
      //   throw new Error('Authentication required');
      // }

      const cachingService = createCachingService(context.env);
      const cacheKey = CacheKeys.feedbackCategories();

      try {
        const cachedCategories = await cachingService.getOrSet(
          cacheKey,
          async () => {
            const db = createD1Client(context.env);
            const categories = await db
              .select()
              .from(schema.feedbackCategory)
              .where(eq(schema.feedbackCategory.isActive, 1))
              .orderBy(desc(schema.feedbackCategory.priorityLevel))
              .all();

            return Promise.all(
              categories.map(async (category) => {
                const ticketCount = await db
                  .select({ count: sql<number>`count(*)` })
                  .from(schema.feedbackTicket)
                  .where(eq(schema.feedbackTicket.categoryId, category.id))
                  .get();

                return {
                  ...category,
                  ticketCount: ticketCount?.count || 0,
                };
              }),
            );
          },
          CacheTTL.MEDIUM,
        );

        return cachedCategories;
      } catch (error) {
        console.error('Error fetching feedback categories:', error);
        throw new Error(
          `Failed to fetch categories: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }
    },
  },

  Mutation: {
    async createTicket(
      _parent: unknown,
      { input }: { input: any },
      context: ContextType,
    ) {
      if (!context.user) {
        throw new Error('Authentication required');
      }

      try {
        const db = createD1Client(context.env);

        // Verify category exists and is active
        const category = await db
          .select()
          .from(schema.feedbackCategory)
          .where(
            and(
              eq(schema.feedbackCategory.id, input.categoryId),
              eq(schema.feedbackCategory.isActive, 1),
            ),
          )
          .get();

        if (!category) {
          throw new Error('Invalid or inactive category');
        }

        const ticketId = nanoid();
        const deviceInfo = input.deviceInfo ? JSON.stringify(input.deviceInfo) : null;

        await db.insert(schema.feedbackTicket).values({
          id: ticketId,
          userId: context.user.id,
          categoryId: input.categoryId,
          subject: input.subject,
          description: input.description,
          priority: input.priority || 'medium',
          type: input.type || 'feedback',
          status: 'open',
          deviceInfo,
          appVersion: input.deviceInfo?.appVersion || null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });

        // Handle attachments if provided
        if (input.attachmentIds?.length) {
          await Promise.all(
            input.attachmentIds.map((mediaId: string) =>
              db.insert(schema.feedbackAttachment).values({
                id: nanoid(),
                ticketId,
                mediaId,
                uploadedBy: context.user.id,
                createdAt: new Date().toISOString(),
              }),
            ),
          );
        }

        // Fetch the created ticket with related data
        const [user, createdTicket] = await Promise.all([
          db
            .select()
            .from(schema.profile)
            .where(eq(schema.profile.userId, context.user.id))
            .get(),
          db
            .select()
            .from(schema.feedbackTicket)
            .where(eq(schema.feedbackTicket.id, ticketId))
            .get(),
        ]);

        // Invalidate cache
        const cachingService = createCachingService(context.env);
        await cachingService.invalidatePattern('feedback:*');

        return {
          ...createdTicket,
          user,
          category,
          responses: [],
          attachments: [],
          responseCount: 0,
          lastResponseAt: null,
          deviceInfo: createdTicket?.deviceInfo ? JSON.parse(createdTicket.deviceInfo) : null,
        };
      } catch (error) {
        console.error('Error creating ticket:', error);
        throw new Error(
          `Failed to create ticket: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }
    },

    async addTicketResponse(
      _parent: unknown,
      { ticketId, message }: { ticketId: string; message: string },
      context: ContextType,
    ) {
      if (!context.user) {
        throw new Error('Authentication required');
      }

      try {
        const db = createD1Client(context.env);

        // Verify ticket exists and user owns it
        const ticket = await db
          .select()
          .from(schema.feedbackTicket)
          .where(eq(schema.feedbackTicket.id, ticketId))
          .get();

        if (!ticket) {
          throw new Error('Ticket not found');
        }

        if (ticket.userId !== context.user.id) {
          throw new Error('Not authorized to respond to this ticket');
        }

        const responseId = nanoid();
        const now = new Date().toISOString();

        await db.insert(schema.feedbackResponse).values({
          id: responseId,
          ticketId,
          responderId: context.user.id,
          responderType: 'user',
          message,
          isInternal: 0,
          createdAt: now,
        });

        // Update ticket status if it was resolved
        if (ticket.status === 'resolved') {
          await db
            .update(schema.feedbackTicket)
            .set({
              status: 'in_progress',
              updatedAt: now,
            })
            .where(eq(schema.feedbackTicket.id, ticketId));
        }

        // Fetch the created response with user data
        const [user, response] = await Promise.all([
          db
            .select()
            .from(schema.profile)
            .where(eq(schema.profile.userId, context.user.id))
            .get(),
          db
            .select()
            .from(schema.feedbackResponse)
            .where(eq(schema.feedbackResponse.id, responseId))
            .get(),
        ]);

        return {
          ...response,
          responder: user,
          ticket,
        };
      } catch (error) {
        console.error('Error adding ticket response:', error);
        throw new Error(
          `Failed to add response: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }
    },

    async uploadTicketAttachment(
      _parent: unknown,
      { input }: { input: { ticketId: string; mediaId: string; description?: string } },
      context: ContextType,
    ) {
      if (!context.user) {
        throw new Error('Authentication required');
      }

      try {
        const db = createD1Client(context.env);

        // Verify ticket exists and user owns it
        const ticket = await db
          .select()
          .from(schema.feedbackTicket)
          .where(eq(schema.feedbackTicket.id, input.ticketId))
          .get();

        if (!ticket) {
          throw new Error('Ticket not found');
        }

        if (ticket.userId !== context.user.id) {
          throw new Error('Not authorized to add attachments to this ticket');
        }

        const attachmentId = nanoid();

        await db.insert(schema.feedbackAttachment).values({
          id: attachmentId,
          ticketId: input.ticketId,
          mediaId: input.mediaId,
          uploadedBy: context.user.id,
          description: input.description || null,
          createdAt: new Date().toISOString(),
        });

        // Fetch the created attachment with related data
        const [media, user, attachment] = await Promise.all([
          db
            .select()
            .from(schema.media)
            .where(eq(schema.media.id, input.mediaId))
            .get(),
          db
            .select()
            .from(schema.profile)
            .where(eq(schema.profile.userId, context.user.id))
            .get(),
          db
            .select()
            .from(schema.feedbackAttachment)
            .where(eq(schema.feedbackAttachment.id, attachmentId))
            .get(),
        ]);

        return {
          ...attachment,
          media,
          uploadedBy: user,
          ticket,
        };
      } catch (error) {
        console.error('Error uploading ticket attachment:', error);
        throw new Error(
          `Failed to upload attachment: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }
    },

    async updateTicketStatus(
      _parent: unknown,
      { ticketId, status }: { ticketId: string; status: string },
      context: ContextType,
    ) {
      if (!context.user) {
        throw new Error('Authentication required');
      }

      try {
        const db = createD1Client(context.env);

        // For now, allow both users and admins to update status
        // TODO: Add proper role-based access control
        const ticket = await db
          .select()
          .from(schema.feedbackTicket)
          .where(eq(schema.feedbackTicket.id, ticketId))
          .get();

        if (!ticket) {
          throw new Error('Ticket not found');
        }

        const now = new Date().toISOString();
        const updateData: any = {
          status,
          updatedAt: now,
        };

        if (status === 'resolved' || status === 'closed') {
          updateData.resolvedAt = now;
        }

        await db
          .update(schema.feedbackTicket)
          .set(updateData)
          .where(eq(schema.feedbackTicket.id, ticketId));

        // Fetch updated ticket with related data
        const [user, category, updatedTicket] = await Promise.all([
          db
            .select()
            .from(schema.profile)
            .where(eq(schema.profile.userId, ticket.userId))
            .get(),
          db
            .select()
            .from(schema.feedbackCategory)
            .where(eq(schema.feedbackCategory.id, ticket.categoryId))
            .get(),
          db
            .select()
            .from(schema.feedbackTicket)
            .where(eq(schema.feedbackTicket.id, ticketId))
            .get(),
        ]);

        return {
          ...updatedTicket,
          user,
          category,
          responses: [],
          attachments: [],
          responseCount: 0,
          deviceInfo: updatedTicket?.deviceInfo ? JSON.parse(updatedTicket.deviceInfo) : null,
        };
      } catch (error) {
        console.error('Error updating ticket status:', error);
        throw new Error(
          `Failed to update ticket status: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }
    },

    async addAdminResponse(
      _parent: unknown,
      {
        ticketId,
        message,
        isInternal = false,
      }: { ticketId: string; message: string; isInternal?: boolean },
      context: ContextType,
    ) {
      if (!context.user) {
        throw new Error('Authentication required');
      }

      // TODO: Add admin role check here when roles are implemented

      try {
        const db = createD1Client(context.env);

        const ticket = await db
          .select()
          .from(schema.feedbackTicket)
          .where(eq(schema.feedbackTicket.id, ticketId))
          .get();

        if (!ticket) {
          throw new Error('Ticket not found');
        }

        const responseId = nanoid();
        const now = new Date().toISOString();

        await db.insert(schema.feedbackResponse).values({
          id: responseId,
          ticketId,
          responderId: context.user.id,
          responderType: 'admin',
          message,
          isInternal: isInternal ? 1 : 0,
          createdAt: now,
        });

        // Update ticket status to in_progress if it was open
        if (ticket.status === 'open') {
          await db
            .update(schema.feedbackTicket)
            .set({
              status: 'in_progress',
              assignedAdminId: context.user.id,
              updatedAt: now,
            })
            .where(eq(schema.feedbackTicket.id, ticketId));
        }

        // Fetch the created response with user data
        const [user, response] = await Promise.all([
          db
            .select()
            .from(schema.profile)
            .where(eq(schema.profile.userId, context.user.id))
            .get(),
          db
            .select()
            .from(schema.feedbackResponse)
            .where(eq(schema.feedbackResponse.id, responseId))
            .get(),
        ]);

        return {
          ...response,
          responder: user,
          ticket,
        };
      } catch (error) {
        console.error('Error adding admin response:', error);
        throw new Error(
          `Failed to add admin response: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }
    },

    async createFeedbackCategory(
      _parent: unknown,
      { input }: { input: any },
      context: ContextType,
    ) {
      if (!context.user) {
        throw new Error('Authentication required');
      }

      // TODO: Add admin role check here when roles are implemented

      try {
        const db = createD1Client(context.env);

        const categoryId = nanoid();

        await db.insert(schema.feedbackCategory).values({
          id: categoryId,
          name: input.name,
          description: input.description || null,
          priorityLevel: input.priorityLevel || 1,
          isActive: input.isActive !== false ? 1 : 0,
          createdAt: new Date().toISOString(),
        });

        const category = await db
          .select()
          .from(schema.feedbackCategory)
          .where(eq(schema.feedbackCategory.id, categoryId))
          .get();

        // Invalidate cache
        const cachingService = createCachingService(context.env);
        await cachingService.delete(CacheKeys.feedbackCategories());

        return {
          ...category,
          ticketCount: 0,
        };
      } catch (error) {
        console.error('Error creating feedback category:', error);
        throw new Error(
          `Failed to create category: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }
    },

    async updateFeedbackCategory(
      _parent: unknown,
      { id, input }: { id: string; input: any },
      context: ContextType,
    ) {
      if (!context.user) {
        throw new Error('Authentication required');
      }

      // TODO: Add admin role check here when roles are implemented

      try {
        const db = createD1Client(context.env);

        const category = await db
          .select()
          .from(schema.feedbackCategory)
          .where(eq(schema.feedbackCategory.id, id))
          .get();

        if (!category) {
          throw new Error('Category not found');
        }

        await db
          .update(schema.feedbackCategory)
          .set({
            name: input.name || category.name,
            description: input.description !== undefined ? input.description : category.description,
            priorityLevel: input.priorityLevel !== undefined ? input.priorityLevel : category.priorityLevel,
            isActive: input.isActive !== undefined ? (input.isActive ? 1 : 0) : category.isActive,
          })
          .where(eq(schema.feedbackCategory.id, id));

        const updatedCategory = await db
          .select()
          .from(schema.feedbackCategory)
          .where(eq(schema.feedbackCategory.id, id))
          .get();

        const ticketCount = await db
          .select({ count: sql<number>`count(*)` })
          .from(schema.feedbackTicket)
          .where(eq(schema.feedbackTicket.categoryId, id))
          .get();

        // Invalidate cache
        const cachingService = createCachingService(context.env);
        await cachingService.delete(CacheKeys.feedbackCategories());

        return {
          ...updatedCategory,
          ticketCount: ticketCount?.count || 0,
        };
      } catch (error) {
        console.error('Error updating feedback category:', error);
        throw new Error(
          `Failed to update category: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }
    },
  },

  // Type resolvers for nested fields
  FeedbackTicket: {
    async user(parent: { userId: string; user?: any }, _: unknown, context: ContextType) {
      if (parent.user) return parent.user;

      const db = createD1Client(context.env);
      return await db
        .select()
        .from(schema.profile)
        .where(eq(schema.profile.userId, parent.userId))
        .get();
    },

    async category(parent: { categoryId: string; category?: any }, _: unknown, context: ContextType) {
      if (parent.category) return parent.category;

      const db = createD1Client(context.env);
      return await db
        .select()
        .from(schema.feedbackCategory)
        .where(eq(schema.feedbackCategory.id, parent.categoryId))
        .get();
    },

    async responses(parent: { id: string; responses?: any[] }, _: unknown, context: ContextType) {
      if (parent.responses) return parent.responses;

      const db = createD1Client(context.env);
      const responses = await db
        .select()
        .from(schema.feedbackResponse)
        .where(eq(schema.feedbackResponse.ticketId, parent.id))
        .orderBy(desc(schema.feedbackResponse.createdAt))
        .all();

      return Promise.all(
        responses.map(async (response) => {
          const responder = await db
            .select()
            .from(schema.profile)
            .where(eq(schema.profile.userId, response.responderId))
            .get();

          return {
            ...response,
            responder,
          };
        }),
      );
    },

    async attachments(parent: { id: string; attachments?: any[] }, _: unknown, context: ContextType) {
      if (parent.attachments) return parent.attachments;

      const db = createD1Client(context.env);
      const attachments = await db
        .select()
        .from(schema.feedbackAttachment)
        .where(eq(schema.feedbackAttachment.ticketId, parent.id))
        .all();

      return Promise.all(
        attachments.map(async (attachment) => {
          const [media, uploadedBy] = await Promise.all([
            db
              .select()
              .from(schema.media)
              .where(eq(schema.media.id, attachment.mediaId))
              .get(),
            db
              .select()
              .from(schema.profile)
              .where(eq(schema.profile.userId, attachment.uploadedBy))
              .get(),
          ]);

          return {
            ...attachment,
            media,
            uploadedBy,
          };
        }),
      );
    },
  },

  FeedbackResponse: {
    async responder(parent: { responderId: string; responder?: any }, _: unknown, context: ContextType) {
      if (parent.responder) return parent.responder;

      const db = createD1Client(context.env);
      return await db
        .select()
        .from(schema.profile)
        .where(eq(schema.profile.userId, parent.responderId))
        .get();
    },

    async ticket(parent: { ticketId: string; ticket?: any }, _: unknown, context: ContextType) {
      if (parent.ticket) return parent.ticket;

      const db = createD1Client(context.env);
      return await db
        .select()
        .from(schema.feedbackTicket)
        .where(eq(schema.feedbackTicket.id, parent.ticketId))
        .get();
    },
  },

  FeedbackAttachment: {
    async media(parent: { mediaId: string; media?: any }, _: unknown, context: ContextType) {
      if (parent.media) return parent.media;

      const db = createD1Client(context.env);
      return await db
        .select()
        .from(schema.media)
        .where(eq(schema.media.id, parent.mediaId))
        .get();
    },

    async uploadedBy(parent: { uploadedBy: string; uploadedByData?: any }, _: unknown, context: ContextType) {
      if (parent.uploadedByData && typeof parent.uploadedByData === 'object') return parent.uploadedByData;

      const db = createD1Client(context.env);
      return await db
        .select()
        .from(schema.profile)
        .where(eq(schema.profile.userId, parent.uploadedBy))
        .get();
    },

    async ticket(parent: { ticketId: string; ticket?: any }, _: unknown, context: ContextType) {
      if (parent.ticket) return parent.ticket;

      const db = createD1Client(context.env);
      return await db
        .select()
        .from(schema.feedbackTicket)
        .where(eq(schema.feedbackTicket.id, parent.ticketId))
        .get();
    },
  },

};

// Helper function for admin stats
async function getAdminTicketStats(db: any) {
    const [total, open, inProgress, resolved, closed, urgent] = await Promise.all([
      db
        .select({ count: sql<number>`count(*)` })
        .from(schema.feedbackTicket)
        .get(),
      db
        .select({ count: sql<number>`count(*)` })
        .from(schema.feedbackTicket)
        .where(eq(schema.feedbackTicket.status, 'open'))
        .get(),
      db
        .select({ count: sql<number>`count(*)` })
        .from(schema.feedbackTicket)
        .where(eq(schema.feedbackTicket.status, 'in_progress'))
        .get(),
      db
        .select({ count: sql<number>`count(*)` })
        .from(schema.feedbackTicket)
        .where(eq(schema.feedbackTicket.status, 'resolved'))
        .get(),
      db
        .select({ count: sql<number>`count(*)` })
        .from(schema.feedbackTicket)
        .where(eq(schema.feedbackTicket.status, 'closed'))
        .get(),
      db
        .select({ count: sql<number>`count(*)` })
        .from(schema.feedbackTicket)
        .where(eq(schema.feedbackTicket.priority, 'urgent'))
        .get(),
    ]);

    // Calculate average response time (simplified version)
    const avgResponseTimeResult = await db
      .select({
        avg: sql<number>`avg(julianday(${schema.feedbackResponse.createdAt}) - julianday(${schema.feedbackTicket.createdAt}))`,
      })
      .from(schema.feedbackTicket)
      .leftJoin(
        schema.feedbackResponse,
        and(
          eq(schema.feedbackResponse.ticketId, schema.feedbackTicket.id),
          eq(schema.feedbackResponse.responderType, 'admin'),
        ),
      )
      .where(eq(schema.feedbackResponse.responderType, 'admin'))
      .get();

    const avgResponseTimeHours = avgResponseTimeResult?.avg ? avgResponseTimeResult.avg * 24 : null;

    return {
      total: total?.count || 0,
      open: open?.count || 0,
      inProgress: inProgress?.count || 0,
      resolved: resolved?.count || 0,
      closed: closed?.count || 0,
      urgentCount: urgent?.count || 0,
      avgResponseTime: avgResponseTimeHours,
    };
}