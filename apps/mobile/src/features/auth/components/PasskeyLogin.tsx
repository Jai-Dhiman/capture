import React, { useEffect, useState } from 'react';
import { Text, TextInput, TouchableOpacity, View } from 'react-native';
import { usePasskey } from '../hooks/usePasskey';

interface PasskeyLoginProps {
  onFallback: () => void;
}

export function PasskeyLogin({ onFallback }: PasskeyLoginProps) {
  const [email, setEmail] = useState('');
  const [biometricName, setBiometricName] = useState<string>('Biometric');

  const { authenticateWithPasskey, getBiometricName, isPasskeySupported, hasBiometrics } =
    usePasskey();

  useEffect(() => {
    const loadBiometricName = async () => {
      const name = await getBiometricName();
      setBiometricName(name);
    };
    loadBiometricName();
  }, [getBiometricName]);

  const handlePasskeyLogin = async () => {
    if (!email.trim()) {
      return;
    }

    try {
      await authenticateWithPasskey.mutateAsync({
        email: email.trim(),
      });
    } catch (error) {
      console.error('Passkey login failed:', error);
    }
  };

  if (!isPasskeySupported || !hasBiometrics) {
    return (
      <View className="flex-1 p-6 justify-center bg-white">
        <Text className="text-3xl font-bold text-center mb-4 text-gray-900">
          Passkey Not Available
        </Text>
        <Text className="text-base text-center mb-8 leading-6 text-gray-600">
          Passkeys are not supported on this device. Please use email authentication.
        </Text>
        <TouchableOpacity
          className="bg-blue-500 py-4 px-6 rounded-xl items-center"
          onPress={onFallback}
        >
          <Text className="text-white text-lg font-semibold">Use Email Login</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View className="flex-1 p-6 justify-center bg-white">
      <Text className="text-3xl font-bold text-center mb-4 text-gray-900">
        Sign in with {biometricName}
      </Text>
      <Text className="text-base text-center mb-8 leading-6 text-gray-600">
        Enter your email and use your {biometricName.toLowerCase()} to sign in securely.
      </Text>

      <View className="mb-6">
        <TextInput
          className="border border-gray-300 rounded-xl py-4 px-4 text-base bg-gray-50"
          placeholder="Email address"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      <View className="space-y-3 mb-6">
        <TouchableOpacity
          className={`py-4 px-6 rounded-xl items-center ${
            !email.trim() || authenticateWithPasskey.isPending ? 'bg-gray-300' : 'bg-blue-500'
          }`}
          onPress={handlePasskeyLogin}
          disabled={!email.trim() || authenticateWithPasskey.isPending}
        >
          <Text className="text-white text-lg font-semibold">
            {authenticateWithPasskey.isPending
              ? 'Authenticating...'
              : `Sign in with ${biometricName}`}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          className="bg-transparent py-4 px-6 rounded-xl items-center border border-gray-300"
          onPress={onFallback}
          disabled={authenticateWithPasskey.isPending}
        >
          <Text className="text-gray-600 text-base font-medium">Use Email Verification</Text>
        </TouchableOpacity>
      </View>

      <Text className="text-sm text-center text-gray-400 italic">
        Don't have a passkey? Sign in with email to set one up.
      </Text>
    </View>
  );
}
