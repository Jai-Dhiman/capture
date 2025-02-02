import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useSession } from '../lib/supabase';

export default function Feed() {
  const { session } = useSession();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome to Feed</Text>
      {session?.user && (
        <View style={styles.userInfo}>
          <Text style={styles.userText}>User ID: {session.user.id}</Text>
          <Text style={styles.userText}>Email: {session.user.email}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  userInfo: {
    marginTop: 20,
  },
  userText: {
    fontSize: 16,
    marginBottom: 10,
  }
});