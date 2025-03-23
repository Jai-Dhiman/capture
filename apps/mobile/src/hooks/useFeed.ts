import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "stores/authStore";
import { API_URL } from "@env";

export const useFeed = (options: { limit?: number; offset?: number; dateThreshold?: string | null } = {}) => {
  const { limit = 10, offset = 0 } = options;

  const oneMonthAgo = new Date();
  oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
  const dateThreshold = oneMonthAgo.toISOString();

  return useQuery({
    queryKey: ["feed", { limit, offset, dateThreshold }],
    queryFn: async () => {
      const { session } = useAuthStore.getState();

      if (!session?.access_token) {
        throw new Error("No auth token available");
      }

      const response = await fetch(`${API_URL}/graphql`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          query: `
            query GetFeed($limit: Int, $offset: Int, $dateThreshold: String) {
              feed(limit: $limit, offset: $offset, dateThreshold: $dateThreshold) {
                id
                content
                type
                createdAt
                isSaved
                user {
                  id
                  username
                  profileImage
                }
                media {
                  id
                  storageKey
                  type
                  order
                }
                hashtags {
                  id
                  name
                }
                _commentCount
              }
            }
          `,
          variables: {
            limit,
            offset,
            dateThreshold,
          },
        }),
      });

      const data = await response.json();

      if (data.errors) {
        console.error("GraphQL Errors:", data.errors);
        throw new Error(data.errors[0].message);
      }

      return data.data.feed;
    },
  });
};
