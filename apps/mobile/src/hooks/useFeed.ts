import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "../stores/authStore";
import { API_URL } from "@env";

export const useFeed = (limit = 20) => {
  const { session } = useAuthStore();

  return useQuery({
    queryKey: ["feed"],
    queryFn: async () => {
      if (!session?.access_token) {
        throw new Error("No auth token available");
      }

      try {
        const response = await fetch(`${API_URL}/graphql`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            query: `
              query GetFeed($limit: Int) {
                feed(limit: $limit) {
                  id
                  content
                  type
                  createdAt
                  user {
                    id
                    username
                    profileImage
                    isBlocked
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
                  isSaved
                  _commentCount
                }
              }
            `,
            variables: {
              limit,
            },
          }),
        });

        const data = await response.json();

        if (data.errors) {
          console.error("GraphQL Errors:", data.errors);
          throw new Error(data.errors[0].message || "Unknown GraphQL error");
        }

        const filteredFeed = data.data.feed.filter((post: any) => !post.user.isBlocked);

        return filteredFeed || [];
      } catch (error) {
        console.error("Feed fetch error:", error);
        throw error;
      }
    },
    staleTime: 1 * 60 * 1000,
    retry: 1,
  });
};
