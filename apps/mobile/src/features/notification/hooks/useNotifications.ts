import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/features/auth/stores/authStore";
import { API_URL } from "@env";
import { useEffect } from "react";
import { AppState, type AppStateStatus } from "react-native";

export const useNotifications = (limit = 20, offset = 0, includeRead = false) => {
  const queryClient = useQueryClient();

  // Set up AppState listener to refresh when app becomes active
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextAppState: AppStateStatus) => {
      if (nextAppState === "active") {
        queryClient.invalidateQueries({ queryKey: ["notifications"] });
      }
    });

    return () => {
      subscription.remove();
    };
  }, [queryClient]);

  return useQuery({
    queryKey: ["notifications", limit, offset, includeRead],
    queryFn: async () => {
      const { session } = useAuthStore.getState();
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
            query GetNotifications($limit: Int, $offset: Int, $includeRead: Boolean) {
              notifications(limit: $limit, offset: $offset, includeRead: $includeRead) {
                id
                type
                message
                isRead
                createdAt
                actionUser {
                  userId
                  username
                  profileImage
                }
                resourceId
                resourceType
              }
            }
          `,
          variables: { limit, offset, includeRead },
        }),
      });

      const data = await response.json();
      if (data.errors) {
        console.error(data.errors);
        return [];
      }
      return data.data.notifications || [];
    },
  });
};

export const useUnreadNotificationCount = () => {
  const queryClient = useQueryClient();

  // Set up AppState listener to refresh when app becomes active
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextAppState: AppStateStatus) => {
      if (nextAppState === "active") {
        queryClient.invalidateQueries({ queryKey: ["unreadNotificationCount"] });
      }
    });

    return () => {
      subscription.remove();
    };
  }, [queryClient]);

  return useQuery({
    queryKey: ["unreadNotificationCount"],
    queryFn: async () => {
      const { session } = useAuthStore.getState();
      if (!session?.access_token) {
        return 0;
      }

      const response = await fetch(`${API_URL}/graphql`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          query: `
            query GetUnreadNotificationCount {
              unreadNotificationCount
            }
          `,
        }),
      });

      const data = await response.json();
      if (data.errors) {
        return 0;
      }
      return data.data.unreadNotificationCount || 0;
    },
  });
};

export const useMarkNotificationRead = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
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
            mutation MarkNotificationRead($id: ID!) {
              markNotificationRead(id: $id) {
                success
              }
            }
          `,
          variables: { id },
        }),
      });

      const data = await response.json();
      if (data.errors) {
        throw new Error(data.errors[0]?.message || "Failed to mark notification as read");
      }
      return data.data.markNotificationRead;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["unreadNotificationCount"] });
    },
  });
};

export const useMarkAllNotificationsRead = () => {
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
            mutation MarkAllNotificationsRead {
              markAllNotificationsRead {
                success
                count
              }
            }
          `,
        }),
      });

      const data = await response.json();
      if (data.errors) {
        throw new Error(data.errors[0]?.message || "Failed to mark all notifications as read");
      }
      return data.data.markAllNotificationsRead;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["unreadNotificationCount"] });
    },
  });
};
