import React from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '@/navigation/types';
import EmailIcon from '@assets/icons/EmailIcon.svg';
import Header from '@/shared/components/Header';
import { OAuthButtons } from '../components/OAuthButtons';

type Props = {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'RegisterScreen'>;
};

export default function RegisterScreen({ navigation }: Props) {
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

          <TouchableOpacity
            onPress={() => navigation.navigate('EmailSignup')}
            className="bg-white h-[56px] rounded-[30px] shadow-md flex-row items-center justify-center mb-[23px]"
          >
            <EmailIcon width={24} height={24} style={{ marginRight: 16 }} />
            <Text className="text-base font-bold font-roboto text-[#1C1C1C]">
              Continue with Email
            </Text>
          </TouchableOpacity>

          <OAuthButtons showDivider={false} />

          <TouchableOpacity
            onPress={() => navigation.navigate('EmailSignup')}
            className="bg-[#827B85] h-[56px] rounded-[30px] shadow-md flex-row items-center justify-center mb-[23px]"
          >
            <Text className="text-base font-bold font-roboto text-[#FFFFFF] text-center">
              Create Business Account
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}