import { graphqlFetch } from '@/shared/lib/graphqlClient';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export const useSearchHashtags = (query: string, enabled = false) => {
  return useQuery({
    queryKey: ['hashtags', 'search', query],
    queryFn: async () => {
      const data = await graphqlFetch<{ searchHashtags: any[] }>({
        query: `
          query SearchHashtags($query: String!, $limit: Int) {
            searchHashtags(query: $query, limit: $limit) {
              id
              name
            }
          }
        `,
        variables: {
          query,
          limit: 10,
        },
      });

      return data.searchHashtags || [];
    },
    enabled: enabled && query.length > 0,
    staleTime: 1000 * 60 * 5, // Cache results for 5 minutes
  });
};

export const useCreateHashtag = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (name: string) => {
      const data = await graphqlFetch<{ createHashtag: any }>({
        query: `
          mutation CreateHashtag($name: String!) {
            createHashtag(name: $name) {
              id
              name
            }
          }
        `,
        variables: {
          name,
        },
      });

      return data.createHashtag;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hashtags'] });
    },
  });
};
