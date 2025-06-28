import type { AuthStackParamList } from '@/navigation/types';
import Header from '@/shared/components/Header';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useEffect, useState } from 'react';
import { Alert, Text, TouchableOpacity, View, Image, ActivityIndicator } from 'react-native';
import { Platform } from 'react-native';
import { usePasskey } from '../hooks/usePasskey';
import { useAuth } from '../hooks/useAuth';
import { useAuthStore } from '../stores/authStore';

type Props = {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'PasskeySetup'>;
};

export default function PasskeySetupScreen({ navigation }: Props) {
  const authStage = useAuthStore((state) => state.stage);
  const user = useAuthStore((state) => state.user);
  const { logout } = useAuth();
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

  const isMandatory = authStage === 'securitySetupRequired';

  const shadowStyle = {
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
    }),
  };

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
      // Navigation handled automatically by MainNavigator based on auth store state changes
    } catch (error) {
      console.error('Passkey setup failed:', error);
    }
  };

  const handleSkip = () => {
    if (isMandatory) {
      navigation.navigate('MFACreation');
    } else {
      navigation.navigate('CreateProfile');
    }
  };

  const handleSkipPasskey = () => {
    if (isMandatory) {
      Alert.alert(
        'Alternative Security Required',
        'You need to set up some form of multi-factor authentication. Would you like to set up alternative MFA instead of passkeys?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Setup MFA Instead', style: 'default', onPress: handleSkip },
        ],
      );
    } else {
      Alert.alert(
        'Skip Passkey Setup?',
        "You can set up passkeys later in Settings. For now, you'll need to use other security methods.",
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Skip', style: 'destructive', onPress: handleSkip },
        ],
      );
    }
  };

  const handleBackPress = () => {
    Alert.alert(
      'Are you sure?',
      'You will be logged out and returned to the login screen.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Log Out',
          onPress: () => {
            logout.mutate(undefined, {
              onSuccess: () => {
              },
            });
          },
          style: 'destructive',
        },
      ],
      { cancelable: false },
    );
  };

  const renderPasskeySetupContent = () => {
    if (isCapabilitiesLoading) {
      return (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#000" />
          <Text className="text-base text-center text-gray-600 font-roboto mt-4">
            Checking device capabilities...
          </Text>
        </View>
      );
    }

    if (!isPasskeySupported || !hasBiometrics) {
      return (
        <View className="flex-1 px-[26px] pt-[80px]">
          <View className="mb-8">
            <Text className="text-2xl font-semibold text-center mb-4 text-gray-900 font-roboto">
              {isMandatory ? 'Security Setup Required' : 'Passkeys Not Available'}
            </Text>
            <Text className="text-sm text-center text-gray-900/80 font-roboto leading-normal">
              {isMandatory
                ? "Your device doesn't support passkeys, but we need to set up some form of security. Let's set up alternative multi-factor authentication."
                : "Your device doesn't support passkeys or biometric authentication isn't set up. You can continue with email authentication."
              }
            </Text>
          </View>

          <TouchableOpacity
            className="h-[56px] bg-[#E4CAC7] rounded-[30px] justify-center items-center"
            onPress={handleSkip}
            style={shadowStyle}
          >
            <Text className="text-base font-bold font-roboto text-black">
              {isMandatory ? 'Setup Alternative MFA' : 'Continue'}
            </Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View className="flex-1 px-[26px] pt-[80px]">
        {/* Title */}
        <View className="mb-6">
          <Text className="text-center text-gray-900 text-2xl font-semibold font-roboto mb-4">
            Enable Passkeys
          </Text>
          <Text className="text-center text-gray-900/80 text-sm font-normal font-roboto leading-normal">
            Passkeys are easier to use and far more secure than traditional passwords
          </Text>
        </View>

        {/* Benefits List */}
        <View className="mb-8">
          {/* Benefit 1 */}
          <View className="flex-row items-center mb-6">
            <View className="w-8 h-8 mr-4 justify-center items-center">
              <View className="w-6 h-6 bg-black rounded-full" />
            </View>
            <Text className="text-gray-900 text-base font-semibold font-roboto flex-1">
              Sign in without a password
            </Text>
          </View>

          {/* Benefit 2 */}
          <View className="flex-row items-center mb-6">
            <View className="w-8 h-8 mr-4 justify-center items-center">
              <View className="w-6 h-6 bg-black rounded-full" />
            </View>
            <Text className="text-gray-900 text-base font-semibold font-roboto flex-1">
              Faster logins with {biometricName}
            </Text>
          </View>

          {/* Benefit 3 */}
          <View className="flex-row items-center mb-6">
            <View className="w-8 h-8 mr-4 justify-center items-center">
              <View className="w-6 h-6 bg-black rounded-full" />
            </View>
            <Text className="text-gray-900 text-base font-semibold font-roboto flex-1">
              Can't be stolen or guessed
            </Text>
          </View>

          {/* Benefit 4 */}
          <View className="flex-row items-center mb-6">
            <View className="w-8 h-8 mr-4 justify-center items-center">
              <View className="w-6 h-6 bg-black rounded-full" />
            </View>
            <Text className="text-gray-900 text-base font-semibold font-roboto flex-1">
              Protects against phishing scams
            </Text>
          </View>

          {biometricTypes.length > 0 && (
            <View className="flex-row items-center">
              <View className="w-8 h-8 mr-4 justify-center items-center">
                <View className="w-6 h-6 bg-black rounded-full" />
              </View>
              <Text className="text-gray-900 text-base font-semibold font-roboto flex-1">
                Supports: {biometricTypes.join(', ')}
              </Text>
            </View>
          )}
        </View>

        {/* Enable Passkeys Button */}
        <TouchableOpacity
          className="h-[56px] bg-[#E4CAC7] rounded-[30px] justify-center items-center mb-4"
          onPress={handleSetupPasskey}
          disabled={registerPasskey.isPending}
          style={shadowStyle}
        >
          {registerPasskey.isPending ? (
            <View className="flex-row justify-center items-center">
              <ActivityIndicator size="small" color="#000" />
              <Text className="text-base font-bold font-roboto ml-2 text-black">Setting up...</Text>
            </View>
          ) : (
            <Text className="text-center text-black text-base font-bold font-roboto">
              Enable Passkeys
            </Text>
          )}
        </TouchableOpacity>

        {/* Skip Link */}
        <View className="items-center mt-4">
          <TouchableOpacity onPress={handleSkipPasskey} disabled={registerPasskey.isPending}>
            <Text className="text-base font-semibold font-roboto text-[#827B85] underline">
              {isMandatory ? 'Setup MFA Instead' : "Don't Want A Passkey?"}
            </Text>
          </TouchableOpacity>
        </View>

        <View className="items-center mt-6">
          <Text className="text-sm text-center text-gray-400 font-roboto">
            {isMandatory
              ? 'You need some form of multi-factor authentication to use the app securely.'
              : `You can always set up ${biometricName.toLowerCase()} later in your account settings.`
            }
          </Text>
        </View>
      </View>
    );
  };

  return (
    <View style={{ flex: 1 }}>
      <View className="flex-1 bg-[#DCDCDE] overflow-hidden">
        <Image
          source={require('@assets/DefaultBackground.png')}
          style={{
            opacity: 0.58,
            width: '100%',
            height: '100%',
            position: 'absolute',
            top: 0,
            left: 0,
          }}
          resizeMode="cover"
        />
        <Header height={155} showBackground={false} showBackButton={true} onBackPress={handleBackPress} />
        {renderPasskeySetupContent()}
      </View>
    </View>
  );
}
