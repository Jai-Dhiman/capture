import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/features/auth/stores/authStore";
import { API_URL } from "@env";
import { useAtom } from "jotai";
import { isFollowingAtom } from "../atoms/followingAtoms";
import { useEffect } from "react";
import type { FollowingState } from "../types/followingTypes";

export const useFollowUser = (userId: string) => {
  const queryClient = useQueryClient();
  const [isFollowing, setIsFollowing] = useAtom(isFollowingAtom(userId));

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
            mutation FollowUser($userId: ID!) {
              followUser(userId: $userId) {
                success
                relationship {
                  id
                  followerId
                  followedId
                  createdAt
                }
              }
            }
          `,
          variables: { userId },
        }),
      });

      const data = await response.json();
      if (data.errors) {
        throw new Error(data.errors[0]?.message || "Failed to follow user");
      }
      return data.data.followUser;
    },
    onMutate: () => {
      setIsFollowing(true);
    },
    onError: () => {
      setIsFollowing(false);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["profile", userId] });
      queryClient.invalidateQueries({ queryKey: ["followers"] });
      queryClient.invalidateQueries({ queryKey: ["following"] });
    },
  });
};

export const useUnfollowUser = (userId: string) => {
  const queryClient = useQueryClient();
  const [isFollowing, setIsFollowing] = useAtom(isFollowingAtom(userId));

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
            mutation UnfollowUser($userId: ID!) {
              unfollowUser(userId: $userId) {
                success
              }
            }
          `,
          variables: { userId },
        }),
      });

      const data = await response.json();
      if (data.errors) {
        throw new Error(data.errors[0]?.message || "Failed to unfollow user");
      }
      return data.data.unfollowUser;
    },
    onMutate: () => {
      setIsFollowing(false);
    },
    onError: () => {
      setIsFollowing(true);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["profile", userId] });
      queryClient.invalidateQueries({ queryKey: ["followers"] });
      queryClient.invalidateQueries({ queryKey: ["following"] });
    },
  });
};

export const useFollowers = (userId: string | undefined) => {
  const queryClient = useQueryClient();

  const result = useQuery({
    queryKey: ["followers", userId],
    queryFn: async () => {
      if (!userId) return [];

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
            query GetFollowers($userId: ID!) {
              followers(userId: $userId) {
                id
                userId
                username
                profileImage
                isFollowing
              }
            }
          `,
          variables: { userId },
        }),
      });

      const data = await response.json();
      if (data.errors) {
        throw new Error(data.errors[0]?.message || "Failed to fetch followers");
      }
      return data.data.followers || [];
    },
    enabled: !!userId,
  });

  return result;
};

export const useFollowing = (userId: string | undefined) => {
  const result = useQuery({
    queryKey: ["following", userId],
    queryFn: async () => {
      if (!userId) return [];

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
            query GetFollowing($userId: ID!) {
              following(userId: $userId) {
                id
                userId
                username
                profileImage
                isFollowing
              }
            }
          `,
          variables: { userId },
        }),
      });

      const data = await response.json();
      if (data.errors) {
        return [];
      }
      return data.data?.following || [];
    },
    enabled: !!userId,
  });

  return result;
};

export const useSyncFollowingState = (userData: any[]) => {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!userData || !Array.isArray(userData)) return;

    const jotaiStore = queryClient.getQueryData(["jotai"]) as FollowingState | undefined;
    const currentMap = jotaiStore?.followingMap || {};
    const newMap = { ...currentMap };

    let hasChanges = false;

    userData.forEach((user) => {
      if (user?.userId && user?.isFollowing !== undefined) {
        if (currentMap[user.userId] !== user.isFollowing) {
          newMap[user.userId] = user.isFollowing;
          hasChanges = true;
        }
      }
    });

    if (hasChanges) {
      queryClient.setQueryData<FollowingState>(["jotai"], {
        followingMap: newMap,
      });
    }
  }, [userData]);
};
