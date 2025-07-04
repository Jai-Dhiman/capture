import type { AuthStackParamList } from '@/navigation/types';
import Header from '@/shared/components/Header';
import EmailIcon from '@assets/icons/EmailIcon.svg';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React from 'react';
import { Image, Text, TouchableOpacity, View } from 'react-native';
import { Platform } from 'react-native';
import { AppleOAuthButton, GoogleOAuthButton } from '../components/OAuthButtons';

type Props = {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'RegisterScreen'>;
};

export default function RegisterScreen({ navigation }: Props) {
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

  return (
    <View style={{ flex: 1 }}>
      <View className="flex-1 bg-[#DCDCDE] overflow-hidden">
        <Image
          source={require('@assets/DefaultBackground.png')}
          style={{
            opacity: 0.6,
            width: '100%',
            height: '100%',
            position: 'absolute',
            top: 0,
            left: 0,
          }}
          resizeMode="cover"
        />

        <Header
          showBackButton={true}
          onBackPress={() => navigation.goBack()}
          showBackground={false}
          height={140}
        />

        <View className="flex-1 px-[26px] justify-center">
          <View className="flex flex-col space-y-[23px] mb-[145px]">
            <TouchableOpacity
              onPress={() => navigation.navigate('EmailSignup')}
              className="bg-white h-[56px] rounded-[30px] shadow-md flex-row items-center justify-center mb-[30px]"
            >
              <EmailIcon width={24} height={24} style={{ marginRight: 16 }} />
              <Text className="text-base font-bold font-roboto text-[#1C1C1C]">
                Continue with Email
              </Text>
            </TouchableOpacity>

            <View className="mb-[30px]" style={shadowStyle}>
              <GoogleOAuthButton />
            </View>

            <View className="mb-[30px]" style={shadowStyle}>
              <AppleOAuthButton />
            </View>

            <TouchableOpacity
              onPress={() => navigation.navigate('EmailSignup')}
              className="bg-[#827B85] h-[56px] rounded-[30px] shadow-md flex-row items-center justify-center"
            >
              <Text className="text-base font-bold font-roboto text-[#FFFFFF] text-center">
                Create Business Account
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
}
