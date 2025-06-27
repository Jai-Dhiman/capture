import type { AuthStackParamList } from '@/navigation/types';
import Header from '@/shared/components/Header';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import { Alert, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useAuthStore } from '../stores/authStore';

type Props = {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'MFACreation'>;
};

export default function MFACreationScreen({ navigation }: Props) {
  const authStage = useAuthStore((state) => state.stage);
  const [selectedMFA, setSelectedMFA] = useState<string | null>(null);

  const isMandatory = authStage === 'securitySetupRequired';

  const mfaOptions = [
    {
      id: 'sms',
      title: 'SMS Authentication',
      description: 'Receive verification codes via text message',
      icon: '📱',
      available: true,
    },
    {
      id: 'email',
      title: 'Email Verification',
      description: 'Enhanced email verification for additional security',
      icon: '📧',
      available: true,
    },
    {
      id: 'authenticator',
      title: 'Authenticator App',
      description: 'Use apps like Google Authenticator or Authy',
      icon: '🔐',
      available: false, // Not implemented yet
    },
  ];

  const handleSetupMFA = async () => {
    if (!selectedMFA) {
      Alert.alert('Selection Required', 'Please select a multi-factor authentication method.');
      return;
    }

    // For now, we'll just simulate the setup
    // In a real implementation, you'd integrate with your backend
    Alert.alert(
      'MFA Setup',
      `${mfaOptions.find(option => option.id === selectedMFA)?.title} setup would be implemented here.`,
      [
        {
          text: 'OK',
          onPress: () => {
            // For now, just navigate to the next step
            // In real implementation, you'd call your MFA setup API
            handleComplete();
          },
        },
      ],
    );
  };

  const handleComplete = () => {
    if (authStage === 'securitySetupRequired') {
      // For now, simulate completing MFA setup by updating the auth stage
      // In a real implementation, you'd call an API to mark MFA as set up
      // and then check the user's profile status
      const setStage = useAuthStore.getState().setStage;

      // For demo purposes, we'll assume the user needs to create a profile next
      // In reality, you'd check the actual profile status from your backend
      setStage('profileRequired');
      navigation.replace('CreateProfile');
    } else {
      navigation.navigate('CreateProfile');
    }
  };

  const handleSkip = () => {
    if (isMandatory) {
      Alert.alert(
        'Security Required',
        'Multi-factor authentication is required to continue. Please select an option.',
        [{ text: 'OK', style: 'default' }],
      );
    } else {
      navigation.navigate('CreateProfile');
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <Header
        showBackButton={!isMandatory}
        onBackPress={() => navigation.goBack()}
      />

      <ScrollView className="flex-1 bg-white">
        <View className="flex-1 p-6 justify-center">
          <Text className="text-3xl font-bold text-center mb-4 text-gray-900 font-roboto">
            {isMandatory ? 'Security Setup Required' : 'Multi-Factor Authentication'}
          </Text>

          <Text className="text-base text-center mb-8 leading-6 text-gray-600 font-roboto">
            {isMandatory
              ? 'Choose a multi-factor authentication method to secure your account and continue.'
              : 'Add an extra layer of security to protect your account with multi-factor authentication.'
            }
          </Text>

          <View className="mb-8">
            {mfaOptions.map((option) => (
              <TouchableOpacity
                key={option.id}
                className={`p-4 mb-3 rounded-xl border-2 ${selectedMFA === option.id
                  ? 'border-[#E4CAC7] bg-[#E4CAC7]/10'
                  : 'border-gray-200 bg-white'
                  } ${!option.available ? 'opacity-50' : ''}`}
                onPress={() => option.available && setSelectedMFA(option.id)}
                disabled={!option.available}
              >
                <View className="flex-row items-center">
                  <Text className="text-2xl mr-3">{option.icon}</Text>
                  <View className="flex-1">
                    <Text className="text-lg font-semibold text-gray-900 font-roboto">
                      {option.title}
                      {!option.available && (
                        <Text className="text-sm text-gray-500"> (Coming Soon)</Text>
                      )}
                    </Text>
                    <Text className="text-sm text-gray-600 font-roboto">
                      {option.description}
                    </Text>
                  </View>
                  {selectedMFA === option.id && (
                    <View className="w-6 h-6 rounded-full bg-[#E4CAC7] items-center justify-center">
                      <Text className="text-white text-sm font-bold">✓</Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </View>

          <View className="mb-8 p-5 bg-gray-50 rounded-xl">
            <Text className="text-lg font-semibold mb-3 text-gray-900 font-roboto">
              Why Multi-Factor Authentication?
            </Text>
            <Text className="text-base mb-2 text-gray-700 font-roboto">
              • Protects your account even if your password is compromised
            </Text>
            <Text className="text-base mb-2 text-gray-700 font-roboto">
              • Prevents unauthorized access to your personal content
            </Text>
            <Text className="text-base mb-2 text-gray-700 font-roboto">
              • Industry standard for account security
            </Text>
            <Text className="text-base text-gray-700 font-roboto">
              • Required for enhanced app features
            </Text>
          </View>

          <View className="space-y-3 mb-6">
            <TouchableOpacity
              className={`py-4 px-6 rounded-[30px] shadow-md items-center ${selectedMFA
                ? 'bg-[#E4CAC7]'
                : 'bg-gray-300'
                }`}
              onPress={handleSetupMFA}
              disabled={!selectedMFA}
            >
              <Text className="text-base font-bold font-roboto text-black">
                Set Up MFA
              </Text>
            </TouchableOpacity>

            {!isMandatory && (
              <TouchableOpacity
                className="bg-transparent py-4 px-6 rounded-xl items-center border border-gray-300"
                onPress={handleSkip}
              >
                <Text className="text-gray-600 text-base font-medium font-roboto">
                  Skip for now
                </Text>
              </TouchableOpacity>
            )}
          </View>

          <Text className="text-sm text-center text-gray-400 italic font-roboto">
            {isMandatory
              ? 'Multi-factor authentication is required to use the app securely.'
              : 'You can always set up MFA later in your account settings.'
            }
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}
