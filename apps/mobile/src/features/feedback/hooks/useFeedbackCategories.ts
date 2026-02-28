import { graphqlFetch } from '@/shared/lib/graphqlClient';
import { STALE_TIMES } from '@/shared/lib/queryConfig';
import { queryKeys } from '@/shared/lib/queryKeys';
import { useQuery } from '@tanstack/react-query';

export const useFeedbackCategories = () => {
  return useQuery({
    queryKey: queryKeys.feedbackCategories(),
    queryFn: async () => {
      const data = await graphqlFetch<{ feedbackCategories: Array<{ id: string; name: string }> }>({
        query: `
          query GetFeedbackCategories {
            feedbackCategories { id name }
          }
        `,
      });
      return data.feedbackCategories || [];
    },
    staleTime: STALE_TIMES.STATIC,
  });
};
