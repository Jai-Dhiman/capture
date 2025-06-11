import React from 'react'
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import type { AppStackParamList } from '@/navigation/types'
import { ProfileImage } from '@/features/post/components/ProfileImage'
import { FollowButton } from './FollowButton'
import { useSyncFollowingState } from '@/features/profile/hooks/useRelationships'
import Header from '@/shared/components/Header'
import { SkeletonLoader, SkeletonElement } from '@/shared/components/SkeletonLoader';

type NavigationProp = NativeStackNavigationProp<AppStackParamList>

interface UserItem {
  id: string
  userId: string
  username: string
  profileImage?: string
  isFollowing?: boolean | null
}

interface FollowListProps {
  data: UserItem[]
  loading: boolean
  onClose: () => void
  currentUserId: string | undefined
}

export const FollowList = ({
  data,
  loading,
  onClose,
  currentUserId
}: FollowListProps) => {
  const navigation = useNavigation<NavigationProp>()

  useSyncFollowingState(data)

  const renderItem = ({ item }: { item: UserItem }) => {
    const isCurrentUser = item.userId === currentUserId

    return (
      <View className="flex-row items-center p-4 border-b border-gray-200">
        <TouchableOpacity
          onPress={() => {
            onClose()
            navigation.navigate('Profile', { userId: item.userId })
          }}
          className="flex-row flex-1 items-center"
        >
          {item.profileImage ? (
            <View className="w-12 h-12 rounded-full overflow-hidden">
              <ProfileImage cloudflareId={item.profileImage} />
            </View>
          ) : (
            <View className="w-12 h-12 rounded-full bg-gray-200" />
          )}

          <Text className="ml-3 font-medium">{item.username}</Text>
        </TouchableOpacity>

        {!isCurrentUser && (
          <FollowButton
            userId={item.userId}
            isFollowing={item.isFollowing ?? null}
            className="py-1 px-3"
          />
        )}
      </View>
    )
  }

  return (
    <View className="flex-1 bg-white">
      <Header
        showBackButton={true}
        onBackPress={onClose}
      />

      {loading ? (
        <View className="flex-1 p-4">
          <SkeletonLoader isLoading={true}>
            {Array(4).fill(0).map((_, index) => (
              <View key={index} className="flex-row items-center mb-5">
                <SkeletonElement width={48} height={48} radius="round" />
                <View className="flex-1 ml-4">
                  <SkeletonElement width={144} height={20} />
                </View>
              </View>
            ))}
          </SkeletonLoader>
        </View>
      ) : data.length === 0 ? (
        <View className="flex-1 justify-center items-center p-4">
          <Text className="text-gray-500 text-center">No followers yet</Text>
        </View>
      ) : (
        <FlatList
          data={data}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  )
}