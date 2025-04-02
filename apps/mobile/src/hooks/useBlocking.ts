import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "../stores/authStore";
import { API_URL } from "@env";

export const useBlockUser = (userId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
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
            mutation BlockUser($userId: ID!) {
              blockUser(userId: $userId) {
                success
                blockedUser {
                  id
                  username
                }
              }
            }
          `,
          variables: { userId },
        }),
      });

      const data = await response.json();
      if (data.errors) {
        throw new Error(data.errors[0]?.message || "Failed to block user");
      }
      return data.data.blockUser;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["blockedUsers"] });
      queryClient.invalidateQueries({ queryKey: ["feed"] });
      queryClient.invalidateQueries({ queryKey: ["profile", userId] });
    },
  });
};

export const useUnblockUser = (userId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
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
            mutation UnblockUser($userId: ID!) {
              unblockUser(userId: $userId) {
                success
              }
            }
          `,
          variables: { userId },
        }),
      });

      const data = await response.json();
      if (data.errors) {
        throw new Error(data.errors[0]?.message || "Failed to unblock user");
      }
      return data.data.unblockUser;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["blockedUsers"] });
      queryClient.invalidateQueries({ queryKey: ["feed"] });
    },
  });
};

export const useBlockedUsers = () => {
  const { session } = useAuthStore();

  return useQuery({
    queryKey: ["blockedUsers"],
    queryFn: async () => {
      if (!session?.access_token) {
        return [];
      }

      const response = await fetch(`${API_URL}/graphql`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          query: `
            query GetBlockedUsers {
              blockedUsers {
                id
                userId
                username
                profileImage
                createdAt
              }
            }
          `,
        }),
      });

      const data = await response.json();
      if (data.errors) {
        throw new Error(data.errors[0]?.message || "Failed to fetch blocked users");
      }
      return data.data.blockedUsers || [];
    },
    enabled: !!session?.access_token,
  });
};
