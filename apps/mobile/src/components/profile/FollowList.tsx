import React from 'react'
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { AppStackParamList } from '../Navigators/types/navigation'
import { ProfileImage } from '../media/ProfileImage'
import { FollowButton } from './FollowButton'
import { useSyncFollowingState } from '../../hooks/useRelationships'
import Header from '../ui/Header'
import SkeletonContent from 'react-native-skeleton-content';

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
        <SkeletonContent
          containerStyle={{ width: "100%" }}
          isLoading={true}
          layout={[
            { flexDirection: "row", alignItems: "center", marginBottom: 20, children: [
              { width: 50, height: 50, borderRadius: 25, marginRight: 15 },
              { width: 150, height: 20 }
            ]},
            { flexDirection: "row", alignItems: "center", marginBottom: 20, children: [
              { width: 50, height: 50, borderRadius: 25, marginRight: 15 },
              { width: 150, height: 20 }
            ]},
            { flexDirection: "row", alignItems: "center", marginBottom: 20, children: [
              { width: 50, height: 50, borderRadius: 25, marginRight: 15 },
              { width: 150, height: 20 }
            ]},
            { flexDirection: "row", alignItems: "center", marginBottom: 20, children: [
              { width: 50, height: 50, borderRadius: 25, marginRight: 15 },
              { width: 150, height: 20 }
            ]}
          ]}
        />
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