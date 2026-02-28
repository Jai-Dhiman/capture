import { graphqlFetch } from '@/shared/lib/graphqlClient';
import { STALE_TIMES } from '@/shared/lib/queryConfig';
import { useQuery } from '@tanstack/react-query';

export const useMyTickets = (status?: string, limit = 10, offset = 0) => {
  return useQuery({
    queryKey: ['myTickets', status, limit, offset],
    queryFn: async () => {
      const data = await graphqlFetch<{ myTickets: any[] }>({
        query: `
          query GetMyTickets($status: TicketStatus, $limit: Int, $offset: Int) {
            myTickets(status: $status, limit: $limit, offset: $offset) {
              id
              subject
              description
              status
              priority
              type
              createdAt
              updatedAt
              responseCount
              lastResponseAt
            }
          }
        `,
        variables: { status, limit, offset },
      });
      return data.myTickets || [];
    },
    staleTime: STALE_TIMES.PROFILE,
  });
};

export const useTicketDetail = (ticketId?: string) => {
  return useQuery({
    queryKey: ['ticket', ticketId],
    queryFn: async () => {
      const data = await graphqlFetch<{ ticket: any }>({
        query: `
          query GetTicket($id: ID!) {
            ticket(id: $id) {
              id
              subject
              description
              status
              priority
              type
              createdAt
              updatedAt
              responses {
                id
                message
                responderType
                createdAt
                responder { id username profileImage }
              }
              attachments {
                id
                description
                createdAt
              }
            }
          }
        `,
        variables: { id: ticketId },
      });
      return data.ticket;
    },
    enabled: !!ticketId,
    staleTime: STALE_TIMES.PROFILE,
  });
};
