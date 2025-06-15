import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

type LoadingSpinnerProps = {
  message?: string;
  fullScreen?: boolean;
};

export const LoadingSpinner = ({
  message = 'Loading...',
  fullScreen = false,
}: LoadingSpinnerProps) => {
  if (fullScreen) {
    return (
      <View style={styles.fullScreenContainer}>
        <ActivityIndicator size="large" color="#E4CAC7" />
        {message && <Text style={styles.text}>{message}</Text>}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ActivityIndicator size="small" color="#E4CAC7" />
      {message && <Text style={styles.text}>{message}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  fullScreenContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10,
  },
  container: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  text: {
    marginLeft: 8,
    fontSize: 16,
    fontFamily: 'Roboto',
    color: '#333',
  },
});
