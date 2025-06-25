import React, { useEffect, useState } from 'react';
import { Alert, Text, TouchableOpacity, View } from 'react-native';
import { usePasskey } from '../hooks/usePasskey';
import { useAuthStore } from '../stores/authStore';

interface PasskeySetupProps {
  onComplete: () => void;
  onSkip: () => void;
  isMandatory?: boolean; // Whether security setup is required
}

export function PasskeySetup({ onComplete, onSkip, isMandatory = false }: PasskeySetupProps) {
  const user = useAuthStore((state) => state.user);
  const [biometricName, setBiometricName] = useState<string>('Biometric');

  const {
    deviceCapabilities,
    isCapabilitiesLoading,
    registerPasskey,
    getBiometricName,
    isPasskeySupported,
    hasBiometrics,
    biometricTypes,
  } = usePasskey();

  useEffect(() => {
    const loadBiometricName = async () => {
      const name = await getBiometricName();
      setBiometricName(name);
    };
    loadBiometricName();
  }, [getBiometricName]);

  const handleSetupPasskey = async () => {
    if (!user?.email) {
      Alert.alert('Error', 'User email not found');
      return;
    }

    try {
      await registerPasskey.mutateAsync({
        email: user.email,
        deviceName: `${deviceCapabilities?.deviceType} Device`,
      });
      onComplete();
    } catch (error) {
      console.error('Passkey setup failed:', error);
    }
  };

  const handleSkipPasskey = () => {
    if (isMandatory) {
      Alert.alert(
        'Alternative Security Required',
        'You need to set up some form of multi-factor authentication. Would you like to set up alternative MFA instead of passkeys?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Setup MFA Instead', style: 'default', onPress: onSkip },
        ],
      );
    } else {
      Alert.alert(
        'Skip Passkey Setup?',
        "You can set up passkeys later in Settings. For now, you'll need to use other security methods.",
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Skip', style: 'destructive', onPress: onSkip },
        ],
      );
    }
  };

  if (isCapabilitiesLoading) {
    return (
      <View className="flex-1 p-6 justify-center bg-white">
        <Text className="text-base text-center text-gray-600 font-roboto">
          Checking device capabilities...
        </Text>
      </View>
    );
  }

  if (!isPasskeySupported || !hasBiometrics) {
    return (
      <View className="flex-1 p-6 justify-center bg-white">
        <Text className="text-3xl font-bold text-center mb-4 text-gray-900 font-roboto">
          {isMandatory ? 'Security Setup Required' : 'Passkeys Not Available'}
        </Text>
        <Text className="text-base text-center mb-8 leading-6 text-gray-600 font-roboto">
          {isMandatory
            ? "Your device doesn't support passkeys, but we need to set up some form of security. Let's set up alternative multi-factor authentication."
            : "Your device doesn't support passkeys or biometric authentication isn't set up. You can continue with email authentication."
          }
        </Text>
        <TouchableOpacity
          className="bg-[#E4CAC7] py-4 px-6 rounded-[30px] shadow-md items-center"
          onPress={onSkip}
        >
          <Text className="text-base font-bold font-roboto text-black">
            {isMandatory ? 'Setup Alternative MFA' : 'Continue'}
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View className="flex-1 p-6 justify-center bg-white">
      <Text className="text-3xl font-bold text-center mb-4 text-gray-900 font-roboto">
        {isMandatory ? 'Security Setup Required' : `Set Up ${biometricName}`}
      </Text>
      <Text className="text-base text-center mb-8 leading-6 text-gray-600 font-roboto">
        {isMandatory
          ? `You need to set up multi-factor authentication to continue. We recommend using your ${biometricName.toLowerCase()} for the best security and experience.`
          : `Use your ${biometricName.toLowerCase()} to sign in quickly and securely. This adds an extra layer of protection to your account.`
        }
      </Text>

      <View className="mb-8 p-5 bg-gray-50 rounded-xl">
        <Text className="text-lg font-semibold mb-3 text-gray-900 font-roboto">Benefits:</Text>
        <Text className="text-base mb-2 text-gray-700 font-roboto">
          • Faster sign-in with {biometricName}
        </Text>
        <Text className="text-base mb-2 text-gray-700 font-roboto">• Enhanced security</Text>
        <Text className="text-base mb-2 text-gray-700 font-roboto">• No passwords to remember</Text>
        {biometricTypes.length > 0 && (
          <Text className="text-base mb-2 text-gray-700 font-roboto">
            • Supports: {biometricTypes.join(', ')}
          </Text>
        )}
      </View>

      <View className="space-y-3 mb-6">
        <TouchableOpacity
          className="bg-[#E4CAC7] py-4 px-6 rounded-[30px] shadow-md items-center"
          onPress={handleSetupPasskey}
          disabled={registerPasskey.isPending}
        >
          <Text className="text-base font-bold font-roboto text-black">
            {registerPasskey.isPending ? 'Setting up...' : `Set Up ${biometricName}`}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          className="bg-transparent py-4 px-6 rounded-xl items-center border border-gray-300"
          onPress={handleSkipPasskey}
          disabled={registerPasskey.isPending}
        >
          <Text className="text-gray-600 text-base font-medium font-roboto">
            {isMandatory ? 'Setup MFA Instead' : 'Skip for now'}
          </Text>
        </TouchableOpacity>
      </View>

      <Text className="text-sm text-center text-gray-400 italic font-roboto">
        {isMandatory
          ? 'You need some form of multi-factor authentication to use the app securely.'
          : `You can always set up ${biometricName.toLowerCase()} later in your account settings.`
        }
      </Text>
    </View>
  );
}
