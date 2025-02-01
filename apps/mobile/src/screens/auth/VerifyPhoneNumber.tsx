import React, { useState } from 'react';
import { View, Text, TouchableOpacity, SafeAreaView, TextInput, Alert } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '../../lib/supabase';
import * as SecureStore from 'expo-secure-store';

type Props = {
  navigation: NativeStackNavigationProp<any>;
};

export default function VerifyPhoneNumberScreen({ navigation }: Props) {
  const [verificationCode, setVerificationCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleVerify = async () => {
    setLoading(true);
    setError(null);

    try {
      // Temporarily bypass phone verification
      navigation.navigate('CreateProfile');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Verification failed';
      setError(errorMessage);
      Alert.alert('Error', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-[#DCDCDE] rounded-[30px] overflow-hidden">
      <View className="flex-1 p-6">
        <Text className="text-2xl font-bold mb-6">Verify Phone Number</Text>

        {/* Verification Code Input */}
        <TextInput
          className="bg-white rounded-lg p-4 mb-4"
          placeholder="Verification Code"
          value={verificationCode}
          onChangeText={setVerificationCode}
          keyboardType="number-pad"
          autoCapitalize="none"
        />

        {/* Submit Button */}
        <TouchableOpacity
          className="bg-blue-500 rounded-lg p-4 items-center"
          onPress={handleVerify}
          disabled={loading}
        >
          <Text className="text-white font-bold">
            {loading ? 'Verifying...' : 'Verify Phone Number'}
          </Text>
        </TouchableOpacity>

        {/* Error Message */}
        {error && (
          <Text className="text-red-500 mt-4">{error}</Text>
        )}
      </View>
    </SafeAreaView>
  );
}