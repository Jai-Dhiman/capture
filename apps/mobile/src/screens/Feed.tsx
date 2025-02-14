import React from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
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

  const handleDeleteAccount = async () => {
    Alert.alert(
      "Delete Account",
      "Are you sure you want to delete your account? This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              if (!authUser?.id) {
                throw new Error('User ID not found');
              }

              const { error: authError } = await supabase.auth.admin.deleteUser(
                authUser.id
              );
              
              if (authError) throw authError;

              clearSession();
              navigation.navigate('Auth');
            } catch (error) {
              console.error('Error deleting account:', error);
              Alert.alert('Error', 'Failed to delete account. Please try again.');
            }
          }
        }
      ]
    );
  };

  return (
    <View className="flex-1 p-5">
      <Text className="text-2xl font-bold mb-5">Welcome to Feed</Text>
      {authUser && (
        <View className="mt-5">
          <Text className="text-base mb-2.5">User ID: {authUser.id}</Text>
          <Text className="text-base mb-2.5">Email: {authUser.email}</Text>
        </View>
      )}

      <TouchableOpacity 
        className="bg-blue-600 p-3 rounded-lg mt-5 items-center"
        onPress={() => navigation.navigate('NewPost')}
      >
        <Text className="text-white text-base font-bold">Create New Post</Text>
      </TouchableOpacity>

      <TouchableOpacity 
        className="bg-red-600 p-3 rounded-lg mt-5 items-center"
        onPress={handleLogout}
      >
        <Text className="text-white text-base font-bold">Logout</Text>
      </TouchableOpacity>
      
      <TouchableOpacity 
        className="bg-red-900 p-3 rounded-lg mt-2.5 items-center"
        onPress={handleDeleteAccount}
      >
        <Text className="text-white text-base font-bold">Delete Account</Text>
      </TouchableOpacity>
    </View>
  );
}