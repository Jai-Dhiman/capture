import React, { useState, useEffect } from 'react'
import { TouchableOpacity, Text, ActivityIndicator } from 'react-native'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '../../stores/authStore'
import { API_URL } from '@env'
import { FollowingState } from '../../types/followingTypes'

interface FollowButtonProps {
  userId: string
  isFollowing: boolean | null
  className?: string
}

export const FollowButton = ({ userId, isFollowing: initialIsFollowing, className = '' }: FollowButtonProps) => {
  const [isFollowing, setIsFollowing] = useState<boolean | null>(initialIsFollowing)
  const queryClient = useQueryClient()
  
  useEffect(() => {
    if (initialIsFollowing !== null && isFollowing === null) {
      setIsFollowing(initialIsFollowing)
      
      const jotaiStore = queryClient.getQueryData(["jotai"]) as FollowingState | undefined
      const followingMap = { ...(jotaiStore?.followingMap || {}) }
      
      if (followingMap[userId] !== initialIsFollowing) {
        followingMap[userId] = initialIsFollowing
        queryClient.setQueryData<FollowingState>(["jotai"], {
          followingMap,
        })
      }
    }
  }, [initialIsFollowing])

  const followMutation = useMutation({
    mutationFn: async () => {
      const { session } = useAuthStore.getState()
      if (!session?.access_token) {
        throw new Error("No auth token available")
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
      })

      const data = await response.json()
      if (data.errors) {
        throw new Error(data.errors[0]?.message || "Failed to follow user")
      }
      return data.data.followUser
    },
    onMutate: () => {
      setIsFollowing(true)
    },
    onError: () => {
      setIsFollowing(false)
    },
    onSuccess: () => {
      const jotaiStore = queryClient.getQueryData(["jotai"]) as FollowingState | undefined
      const followingMap = { ...(jotaiStore?.followingMap || {}) }
      followingMap[userId] = true
      queryClient.setQueryData<FollowingState>(["jotai"], {
        followingMap,
      })
      
      queryClient.invalidateQueries({ queryKey: ["profile", userId] })
      queryClient.invalidateQueries({ queryKey: ["followers"] })
      queryClient.invalidateQueries({ queryKey: ["following"] })
    },
  })

  const unfollowMutation = useMutation({
    mutationFn: async () => {
      const { session } = useAuthStore.getState()
      if (!session?.access_token) {
        throw new Error("No auth token available")
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
      })

      const data = await response.json()
      if (data.errors) {
        throw new Error(data.errors[0]?.message || "Failed to unfollow user")
      }
      return data.data.unfollowUser
    },
    onMutate: () => {
      setIsFollowing(false)
    },
    onError: () => {
      setIsFollowing(true)
    },
    onSuccess: () => {
      const jotaiStore = queryClient.getQueryData(["jotai"]) as FollowingState | undefined
      const followingMap = { ...(jotaiStore?.followingMap || {}) }
      followingMap[userId] = false
      queryClient.setQueryData<FollowingState>(["jotai"], {
        followingMap,
      })
      
      queryClient.invalidateQueries({ queryKey: ["profile", userId] })
      queryClient.invalidateQueries({ queryKey: ["followers"] })
      queryClient.invalidateQueries({ queryKey: ["following"] })
    },
  })
  
  const isPending = followMutation.isPending || unfollowMutation.isPending
  
  const handlePress = () => {
    if (isFollowing) {
      unfollowMutation.mutate()
    } else {
      followMutation.mutate()
    }
  }
  
  if (isFollowing === null) {
    return (
      <TouchableOpacity
        className={`py-2 px-4 bg-gray-100 ${className}`}
        disabled={true}
      >
        <ActivityIndicator size="small" color="#000" />
      </TouchableOpacity>
    )
  }
  
  return (
    <TouchableOpacity
      className={`py-2 px-4 ${isFollowing ? 'bg-gray-200' : 'bg-[#E4CAC7]'} ${className}`}
      onPress={handlePress}
      disabled={isPending}
    >
      {isPending ? (
        <ActivityIndicator size="small" color="#000" />
      ) : (
        <Text className="text-center font-semibold">
          {isFollowing ? 'Unfollow' : 'Follow'}
        </Text>
      )}
    </TouchableOpacity>
  )
}