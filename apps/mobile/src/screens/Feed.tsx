import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { supabase } from '../lib/supabase';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { CompositeNavigationProp } from '@react-navigation/native';
import { useSessionStore } from '../stores/sessionStore';
import { AppStackParamList, RootStackParamList } from '../types/navigation';

type NavigationProp = CompositeNavigationProp<
  NativeStackNavigationProp<AppStackParamList>,
  NativeStackNavigationProp<RootStackParamList>
>;

export default function Feed() {
  const navigation = useNavigation<NavigationProp>();
  const { authUser, clearSession } = useSessionStore();

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      clearSession();
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  return (
    <View className="flex-1 p-5">
      <Text className="text-2xl font-bold mb-5">Welcome to Capture</Text>
      {authUser && (
        <View className="mt-5">
          <Text className="text-base mb-2.5">User ID: {authUser.id}</Text>
          <Text className="text-base mb-2.5">Email: {authUser.email}</Text>
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
      >
        <Text className="text-white text-base font-bold">Logout</Text>
      </TouchableOpacity>
    </View>
  );
}