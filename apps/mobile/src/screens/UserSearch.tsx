import React, { useState } from 'react';
import { View, Text, TextInput, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppStackParamList } from '../types/navigation';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { API_URL } from '@env';
import { ProfileImage } from '../components/media/ProfileImage';

type NavigationProp = NativeStackNavigationProp<AppStackParamList>;

export default function UserSearch() {
  const navigation = useNavigation<NavigationProp>();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    setIsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error('No auth token available');
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

      const data = await response.json();

      if (data.errors) {
        console.error('GraphQL Errors:', data.errors);
        throw new Error(data.errors[0].message);
      }

      setSearchResults(data.data.searchUsers || []);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUserPress = (userId: string) => {
    navigation.navigate('Profile', { userId });
  };

  return (
    <View className="flex-1 bg-white">
      <View className="flex-row items-center p-4 border-b border-gray-100">
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="black" />
        </TouchableOpacity>
        <Text className="text-xl font-semibold ml-4">Find Users</Text>
      </View>

      <View className="flex-row items-center p-4 border-b border-gray-100">
        <TextInput
          className="flex-1 bg-gray-100 rounded-full px-4 py-2 mr-2"
          placeholder="Search users by username"
          value={searchQuery}
          onChangeText={setSearchQuery}
          onSubmitEditing={handleSearch}
        />
        <TouchableOpacity 
          className="bg-[#E4CAC7] p-2 rounded-full" 
          onPress={handleSearch}
        >
          <Ionicons name="search" size={24} color="black" />
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <ActivityIndicator size="large" color="#E4CAC7" className="mt-4" />
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
                  <View className="w-full h-full bg-gray-200" />
                )}
              </View>
              <View className="flex-1">
                <Text className="font-medium">{item.username}</Text>
                {item.bio && (
                  <Text className="text-gray-500 text-sm" numberOfLines={1}>
                    {item.bio}
                  </Text>
                )}
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            searchQuery.trim() !== '' ? (
              <Text className="text-center p-4 text-gray-500">
                No users found matching "{searchQuery}"
              </Text>
            ) : null
          }
        />
      )}
    </View>
  );
}