import React from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import { useSession } from '../lib/supabase';
import { supabase } from '../lib/supabase';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSessionStore } from '../stores/sessionStore';

type RootStackParamList = {
  Login: undefined;
  Signup: undefined;
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function Feed() {
  const { session } = useSession();
  const navigation = useNavigation<NavigationProp>();
  const setSession = useSessionStore((state) => state.setSession);

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
              if (!session?.user?.id) {
                throw new Error('User ID not found');
              }
            
              const { error: dbError } = await supabase
                .from('profiles')
                .delete()
                .eq('id', session.user.id);
              
              if (dbError) throw dbError;

              const { error: authError } = await supabase.auth.admin.deleteUser(
                session.user.id
              );
              
              if (authError) throw authError;

              setSession(null);
              navigation.navigate('Login');
            } catch (error) {
              console.error('Error deleting account:', error);
              Alert.alert('Error', 'Failed to delete account. Please try again.');
            }
          }
        }
      ]
    );
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      navigation.navigate('Login');
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  return (
    <View className="flex-1 p-5">
      <Text className="text-2xl font-bold mb-5">Welcome to Feed</Text>
      {session?.user && (
        <View className="mt-5">
          <Text className="text-base mb-2.5">User ID: {session.user.id}</Text>
          <Text className="text-base mb-2.5">Email: {session.user.email}</Text>
        </View>
      )}
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