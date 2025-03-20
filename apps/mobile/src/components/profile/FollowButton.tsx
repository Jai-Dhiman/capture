import React, { useEffect } from 'react'
import { TouchableOpacity, Text, ActivityIndicator } from 'react-native'
import { useAtom } from 'jotai'
import { isFollowingAtom } from '../../atoms/followingAtoms'
import { useFollowUser, useUnfollowUser } from '../../hooks/useRelationships'

interface FollowButtonProps {
  userId: string
  isFollowing: boolean | null
  className?: string
}

export const FollowButton = ({ userId, isFollowing: initialIsFollowing, className = '' }: FollowButtonProps) => {
  const [isFollowing, setIsFollowing] = useAtom(isFollowingAtom(userId))
  const followMutation = useFollowUser(userId)
  const unfollowMutation = useUnfollowUser(userId)
  
  const isPending = followMutation.isPending || unfollowMutation.isPending
  
  useEffect(() => {
    if (initialIsFollowing !== null && isFollowing !== initialIsFollowing) {
      setIsFollowing(initialIsFollowing)
    }
  }, [initialIsFollowing, userId])
  
  const handlePress = () => {
    if (isFollowing) {
      unfollowMutation.mutate()
    } else {
      followMutation.mutate()
    }
  }
  
  if (isFollowing === null) {
    return null
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
          {isFollowing ? 'Following' : 'Follow'}
        </Text>
      )}
    </TouchableOpacity>
  )
}