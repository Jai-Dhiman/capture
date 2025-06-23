import type { AuthStackParamList } from '@/navigation/types';
import Header from '@/shared/components/Header';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

type Props = {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'PasskeySetup'>;
};

export default function PasskeySetupScreen({ navigation }: Props) {
  const handleContinue = () => {
    navigation.navigate('CreateProfile');
  };

  const handleSkip = () => {
    navigation.navigate('CreateProfile');
  };

  return (
    <View style={{ flex: 1 }}>
      <Header showBackButton={true} onBackPress={() => navigation.goBack()} />

      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
        <Text style={{ fontSize: 24, fontWeight: 'bold', marginBottom: 20 }}>
          Passkey Setup
        </Text>

        <Text style={{ fontSize: 16, textAlign: 'center', marginBottom: 40 }}>
          Set up a passkey for secure, passwordless authentication (Coming Soon)
        </Text>

        <TouchableOpacity
          style={{
            backgroundColor: '#e7cac4',
            paddingHorizontal: 32,
            paddingVertical: 16,
            borderRadius: 30,
            marginBottom: 16,
            width: '100%',
            alignItems: 'center',
          }}
          onPress={handleContinue}
        >
          <Text style={{ fontSize: 16, fontWeight: 'bold', color: 'black' }}>
            Set Up Passkey
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={{
            paddingHorizontal: 32,
            paddingVertical: 16,
            width: '100%',
            alignItems: 'center',
          }}
          onPress={handleSkip}
        >
          <Text style={{ fontSize: 16, color: 'gray' }}>
            Skip for now
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
