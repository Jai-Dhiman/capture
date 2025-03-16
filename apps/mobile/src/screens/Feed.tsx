import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { CompositeNavigationProp } from '@react-navigation/native';
import { AppStackParamList, RootStackParamList } from '../components/Navigators/types/navigation';
import { useAuthStore } from '../stores/authStore';
import { useAuth } from '../hooks/auth/useAuth';

type NavigationProp = CompositeNavigationProp<
  NativeStackNavigationProp<AppStackParamList>,
  NativeStackNavigationProp<RootStackParamList>
>;

export default function Feed() {
  const navigation = useNavigation<NavigationProp>();
  const { user } = useAuthStore();
  const { logout } = useAuth(); 
  
  const handleLogout = () => {
    logout.mutate();
  };

  return (
    <View className="flex-1 p-5">
      <Text className="text-2xl font-bold mb-5">Welcome to Capture</Text>
      {user && (
        <View className="mt-5">
          <Text className="text-base mb-2.5">User ID: {user.id}</Text>
          <Text className="text-base mb-2.5">Email: {user.email}</Text>
          <Text className="text-base mb-2.5">
            Phone: {user.phone || 'Not provided'}
          </Text>
          <Text className="text-base mb-2.5">
            Phone Verified: {user.phone_confirmed_at ? 'Yes' : 'No'}
          </Text>
        </View>
      )}

      <TouchableOpacity 
        className="bg-blue-600 p-3 rounded-lg mt-5 items-center"
        onPress={() => navigation.navigate('Profile')}
      >
        <Text className="text-white text-base font-bold">Profile</Text>
      </TouchableOpacity>

      <TouchableOpacity 
        className="bg-green-600 p-3 rounded-lg mt-5 items-center"
        onPress={() => navigation.navigate('NewPost')}
      >
        <Text className="text-white text-base font-bold">Create New Post</Text>
      </TouchableOpacity>
      
      <TouchableOpacity 
        className="bg-yellow-600 p-3 rounded-lg mt-5 items-center"
        onPress={() => navigation.navigate('Search')}
      >
        <Text className="text-white text-base font-bold">Search</Text>
      </TouchableOpacity>

      <TouchableOpacity 
        className="bg-purple-600 p-3 rounded-lg mt-5 items-center"
        onPress={() => navigation.navigate('SavedPosts')}
      >
        <Text className="text-white text-base font-bold">Saved Posts</Text>
      </TouchableOpacity>

      <TouchableOpacity 
        className="bg-red-600 p-3 rounded-lg mt-5 items-center"
        onPress={handleLogout}
        disabled={logout.isPending}
      >
        <Text className="text-white text-base font-bold">
          {logout.isPending ? 'Logging out...' : 'Logout'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}