import React, { useState } from 'react';
import { View, Text, TextInput, FlatList, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppStackParamList } from '../types/navigation';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { API_URL } from '@env';
import { ProfileImage } from '../components/media/ProfileImage';

type NavigationProp = NativeStackNavigationProp<AppStackParamList>;

type UserSearchResult = {
  id: string;
  userId: string;
  username: string;
  profileImage?: string;
  bio?: string;
  isFollowing?: boolean;
};

export default function UserSearch() {
  const navigation = useNavigation<NavigationProp>();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSearch = async () => {
    // Reset states
    setErrorMessage(null);
    
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    setIsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();

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
      setSearchResults(users);
      
      console.log(`Found ${users.length} users matching "${searchQuery}"`);
      
    } catch (error: any) {
      console.error('Search error:', error);
      setErrorMessage(error.message || 'Failed to search for users. Please try again.');
      setSearchResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUserPress = (userId: string) => {
    navigation.navigate('Profile', { userId });
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
    
    if (searchQuery.trim() !== '') {
      return (
        <View className="flex-1 justify-center items-center p-6">
          <Text className="text-gray-500 text-center mb-2">
            No users found matching "{searchQuery}"
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
          Search for users by username
        </Text>
      </View>
    );
  };

  return (
    <View className="flex-1 bg-white">
      <View className="flex-row items-center p-4 border-b border-gray-100">
        <TouchableOpacity 
          className="p-2" 
          onPress={() => navigation.goBack()}
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={24} color="black" />
        </TouchableOpacity>
        <Text className="text-xl font-semibold ml-2">Find Users</Text>
      </View>

      <View className="flex-row items-center p-4 border-b border-gray-100">
        <TextInput
          className="flex-1 bg-gray-100 rounded-full px-4 py-2 mr-2"
          placeholder="Search users by username"
          value={searchQuery}
          onChangeText={setSearchQuery}
          onSubmitEditing={handleSearch}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TouchableOpacity 
          className="bg-[#E4CAC7] p-2 rounded-full" 
          onPress={handleSearch}
          disabled={isLoading}
          accessibilityLabel="Search button"
        >
          <Ionicons name="search" size={24} color="black" />
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#E4CAC7" />
          <Text className="mt-4 text-gray-500">Searching...</Text>
        </View>
      ) : (
        <FlatList
          data={searchResults}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
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
          )}
          ListEmptyComponent={renderEmptyState}
          contentContainerStyle={{ flexGrow: 1 }}
        />
      )}
    </View>
  );
}