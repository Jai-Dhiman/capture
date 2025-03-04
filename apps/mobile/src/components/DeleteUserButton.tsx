import React, { useState } from 'react';
import { TouchableOpacity, Text, ActivityIndicator } from 'react-native';
import { supabase } from '../lib/supabase';
import { useSessionStore } from '../stores/sessionStore';
import { useNavigation } from '@react-navigation/native';
import { API_URL } from '@env';

export const DeleteUserButton = () => {
  const [isDeleting, setIsDeleting] = useState(false);
  const { authUser, clearSession } = useSessionStore();
  const navigation = useNavigation();

  const handleDeleteUser = async () => {
    try {
      setIsDeleting(true);
      
      if (!authUser) {
        throw new Error('Not authenticated');
      }
      
      const {
        data: { session },
      } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        throw new Error('No auth token available');
      }
      
      const profileResponse = await fetch(`${API_URL}/api/profile/${authUser.id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        }
      });
      
      if (!profileResponse.ok) {
        const errorData = await profileResponse.json();
        throw new Error(errorData.message || 'Failed to delete profile');
      }
      
      const { error } = await supabase.auth.admin.deleteUser(authUser.id);
      if (error) throw error;
    
      await supabase.auth.signOut();
      clearSession();
      
      navigation.reset({
        index: 0,
        routes: [{ name: 'Auth' as never }]
      });
      
    } catch (error) {
      console.error('Error deleting user:', error);
      setIsDeleting(false);
    }
  };

  return (
    <TouchableOpacity 
      className="bg-red-600 p-3 rounded-lg mt-5 items-center"
      onPress={handleDeleteUser}
      disabled={isDeleting}
    >
      {isDeleting ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <Text className="text-white text-base font-bold">Delete Account</Text>
      )}
    </TouchableOpacity>
  );
};