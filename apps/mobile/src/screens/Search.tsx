import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, SectionList, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppStackParamList } from '../components/Navigators/types/navigation';
import { Ionicons } from '@expo/vector-icons';
import { API_URL } from '@env';
import { ProfileImage } from '../components/media/ProfileImage';
import { useSearchHashtags } from '../hooks/useHashtags';
import { useAuthStore } from '../stores/authStore';
import { SkeletonLoader, SkeletonElement } from '../components/ui/SkeletonLoader';
import BackIcon from '../../assets/icons/BackIcon.svg';
import Background1 from '../../assets/Background1.svg';

type NavigationProp = NativeStackNavigationProp<AppStackParamList>;

type UserSearchResult = {
  id: string;
  userId: string;
  username: string;
  profileImage?: string;
  bio?: string;
  isFollowing?: boolean;
};

type HashtagSearchResult = {
  id: string;
  name: string;
};

export default function UserSearch() {
  const navigation = useNavigation<NavigationProp>();
  const { session } = useAuthStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [userResults, setUserResults] = useState<UserSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isHashtagSearch = searchQuery.startsWith('#');
  const hashtagQuery = isHashtagSearch ? searchQuery.substring(1) : '';
  const { data: hashtagResults = [], isLoading: hashtagsLoading } =
    useSearchHashtags(hashtagQuery, isHashtagSearch && hashtagQuery.length > 0);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setDebouncedQuery(searchQuery);
      if (searchQuery.trim()) {
        handleSearch();
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  const handleSearch = async () => {
    setErrorMessage(null);

    if (!searchQuery.trim()) {
      setUserResults([]);
      return;
    }

    if (isHashtagSearch) {
      return;
    }

    setIsLoading(true);
    try {

      if (!session?.access_token) {
        throw new Error('Authentication required. Please log in again.');
      }

      const response = await fetch(`${API_URL}/graphql`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          query: `
            query SearchUsers($query: String!) {
              searchUsers(query: $query) {
                id
                userId
                username
                profileImage
                bio
                isFollowing
              }
            }
          `,
          variables: {
            query: searchQuery,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Network error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      if (data.errors) {
        console.error('GraphQL Errors:', data.errors);
        throw new Error(data.errors[0]?.message || 'Error searching for users');
      }

      const users = data.data?.searchUsers || [];
      setUserResults(users);


    } catch (error: any) {
      console.error('Search error:', error);
      setErrorMessage(error.message || 'Failed to search for users. Please try again.');
      setUserResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUserPress = (userId: string) => {
    navigation.navigate('Profile', { userId });
  };

  const handleHashtagPress = (hashtag: HashtagSearchResult) => {
    // navigation.navigate('HashtagResults', { hashtagId: hashtag.id });
  };

  const renderEmptyState = () => {
    if (errorMessage) {
      return (
        <View className="flex-1 justify-center items-center p-6">
          <Text className="text-red-500 text-center mb-4">{errorMessage}</Text>
          <TouchableOpacity
            className="bg-[#E4CAC7] px-4 py-2 rounded-full"
            onPress={handleSearch}
          >
            <Text className="font-medium">Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (debouncedQuery.trim() !== '') {
      return (
        <View className="flex-1 justify-center items-center p-6">
          <Text className="text-gray-500 text-center mb-2">
            No results found matching "{debouncedQuery}"
          </Text>
          <Text className="text-gray-400 text-center text-sm">
            Try a different search term or check your spelling
          </Text>
        </View>
      );
    }

    return (
      <View className="flex-1 justify-center items-center p-6">
        <Text className="text-gray-400 text-center">
          Search for users by username or hashtags with #
        </Text>
      </View>
    );
  };

  const sections = [];

  if (isHashtagSearch) {
    sections.push({
      title: 'Hashtags',
      data: hashtagResults,
      renderItem: ({ item }: { item: HashtagSearchResult }) => (
        <TouchableOpacity
          className="flex-row items-center p-4 border-b border-gray-100"
          onPress={() => handleHashtagPress(item)}
        >
          <View className="w-12 h-12 rounded-full bg-[#E4CAC7] justify-center items-center mr-4">
            <Text className="text-black font-bold">#</Text>
          </View>
          <View className="flex-1">
            <Text className="font-medium">{item.name}</Text>
          </View>
        </TouchableOpacity>
      )
    });
  } else if (userResults.length > 0) {
    sections.push({
      title: 'Users',
      data: userResults,
      renderItem: ({ item }: { item: UserSearchResult }) => (
        <TouchableOpacity
          className="flex-row items-center p-4 border-b border-gray-100"
          onPress={() => handleUserPress(item.userId)}
        >
          <View className="w-12 h-12 rounded-full overflow-hidden mr-4">
            {item.profileImage ? (
              <ProfileImage cloudflareId={item.profileImage} />
            ) : (
              <View className="w-full h-full bg-gray-200 justify-center items-center">
                <Text className="text-gray-500 font-bold">
                  {item.username?.charAt(0)?.toUpperCase() || '?'}
                </Text>
              </View>
            )}
          </View>
          <View className="flex-1">
            <Text className="font-medium">{item.username}</Text>
            {item.bio ? (
              <Text className="text-gray-500 text-sm" numberOfLines={1}>
                {item.bio}
              </Text>
            ) : null}
          </View>
          {item.isFollowing !== undefined && (
            <Text className="text-sm text-gray-500 ml-2">
              {item.isFollowing ? 'Following' : ''}
            </Text>
          )}
        </TouchableOpacity>
      )
    });
  }

  const isSearchLoading = isLoading || (isHashtagSearch && hashtagsLoading);

  return (
    <View className="flex-1">
      <Background1
        width="100%"
        height="100%"
        style={StyleSheet.absoluteFill}
      />
      <View className="flex-row items-center p-4 pt-20 shadow-md bg-transparent">
        <TouchableOpacity
          className="w-8 h-8 bg-[#DFD2CD] rounded-full drop-shadow-md flex justify-center items-center mr-2"
          style={{ boxShadow: "0 4px 6px rgba(0,0,0,0.2)" }}
          onPress={() => navigation.goBack()}
        >
          <BackIcon width={16} height={16} />
        </TouchableOpacity>
        <View className="flex-1 flex-row items-center bg-white/50 rounded-lg shadow-sm border border-gray-300 py-1">
          <Ionicons name="search" size={18} color="gray" className="absolute left-3 z-10" />
          <TextInput
            className="flex-1 bg-transparent rounded-lg px-4 py-1 pl-9"
            placeholder="Search users or hashtags with #"
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
      </View>

      {isSearchLoading ? (
        <View className="flex-1 p-4">
          <SkeletonLoader isLoading={true}>
            <SkeletonElement width="100%" height={20} />
            {Array(4).fill(0).map((_, index) => (
              <View key={index} className="flex-row items-center mb-4">
                <SkeletonElement width={48} height={48} radius="round" />
                {isHashtagSearch ? (
                  <SkeletonElement width={144} height={20} />
                ) : (
                  <View className="ml-4">
                    <SkeletonElement width={128} height={20} />
                    <SkeletonElement width={192} height={12} />
                  </View>
                )}
              </View>
            ))}
          </SkeletonLoader>
        </View>
      ) : (
        <SectionList
          sections={sections as any}
          keyExtractor={(item) => item.id}
          renderSectionHeader={({ section: { title } }) => (
            sections.length > 0 ? (
              <View className="bg-gray-50 px-4 py-2">
                <Text className="font-semibold text-gray-600">{title}</Text>
              </View>
            ) : null
          )}
          stickySectionHeadersEnabled={false}
          ListEmptyComponent={renderEmptyState}
          contentContainerStyle={{ flexGrow: 1, backgroundColor: 'rgba(229, 231, 235, 0.8)' }}
        />
      )}
    </View>
  );
}