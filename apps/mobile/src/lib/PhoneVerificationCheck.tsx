import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuthStore } from '../stores/authStore';
import Header from '../components/ui/Header';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppStackParamList } from '../components/Navigators/types/navigation';


interface PhoneVerificationCheckProps {
  children: React.ReactNode;
  message?: string;
}

export function PhoneVerificationCheck({ children, message }: PhoneVerificationCheckProps) {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const { user } = useAuthStore();

  const isPhoneVerified = !!user?.phone_confirmed_at;

  if (isPhoneVerified) {
    return <>{children}</>;
  }

  return (
    <View className="flex-1 bg-[#DCDCDE] rounded-[30px]">
      <Header height={120} showBackButton={true} onBackPress={() => navigation.goBack()} />

      <View className="flex-1 justify-center items-center">
        <Text className="text-lg text-center mb-4">
          Phone Verification Check
        </Text>
        <Text className="text-sm text-center mb-6">
          {message || "This action requires phone verification for community safety."}
        </Text>
        <TouchableOpacity
          className="bg-[#E4CAC7] p-3 rounded-lg mb-3"
          onPress={() => navigation.navigate('Settings', {
            screen: 'VerifyPhone'
          })}
        >
          <Text className="text-black text-center font-bold">
            Verify Phone Number
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          className="p-3 mb-3"
          onPress={() => navigation.goBack()}
        >
          <Text className="text-center">
            Go Back
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}