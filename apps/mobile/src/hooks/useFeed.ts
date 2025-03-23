import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "../stores/authStore";
import { API_URL } from "@env";

export const useFeed = (limit = 20) => {
  const { session } = useAuthStore();

  const oneMonthAgo = new Date();
  oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

  return useQuery({
    queryKey: ["feed"],
    queryFn: async () => {
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
            query GetFeed($limit: Int, $dateThreshold: String) {
              feed(limit: $limit, dateThreshold: $dateThreshold) {
                id
                content
                type
                createdAt
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
            dateThreshold: oneMonthAgo.toISOString(),
          },
        }),
      });

      const data = await response.json();

      if (data.errors) {
        console.error("GraphQL Errors:", data.errors);
        throw new Error(data.errors[0].message);
      }

      return data.data.feed || [];
    },
    staleTime: 1 * 60 * 1000,
  });
};
