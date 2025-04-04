import { useInfiniteQuery, QueryFunctionContext } from "@tanstack/react-query";
import { useAuthStore } from "../stores/authStore";
import { API_URL } from "@env";
import { Post } from "../types/postTypes";

interface FeedResponse {
  posts: Post[];
  nextPage: number | undefined;
}

export const useFeed = (limit = 10) => {
  const { session } = useAuthStore();

  return useInfiniteQuery<FeedResponse, Error>({
    queryKey: ["feed"],
    queryFn: async (context: QueryFunctionContext) => {
      const { pageParam } = context;

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
              query GetFeed($limit: Int, $offset: Int) {
                feed(limit: $limit, offset: $offset) {
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
              offset: pageParam,
            },
          }),
        });

        const data = await response.json();

        if (data.errors) {
          console.error("GraphQL Errors:", data.errors);
          throw new Error(data.errors[0].message || "Unknown GraphQL error");
        }

        const filteredFeed = data.data.feed.filter((post: any) => !post.user.isBlocked);

        return {
          posts: filteredFeed || [],
          nextPage: filteredFeed.length === limit ? pageParam + limit : undefined,
        };
      } catch (error) {
        console.error("Feed fetch error:", error);
        throw error;
      }
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage.nextPage,
    staleTime: 1 * 60 * 1000,
    retry: 1,
  });
};
