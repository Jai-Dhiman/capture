import React from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../../components/Navigators/types/navigation';
import Header from '../../components/ui/Header';

type Props = {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'EmailVerificationPending'>
}

export default function EmailVerificationPendingScreen({ navigation }: Props) {
  return (
    <View style={{ flex: 1 }}>
      <View className="flex-1 bg-[#DCDCDE] overflow-hidden">
        <Image
          source={require('../../../assets/DefaultBackground.png')}
          style={{ width: '100%', height: '100%', position: 'absolute' }}
          resizeMode="cover"
        />
        
        <Header 
          showBackButton={true}
          onBackPress={() => navigation.navigate('Login')}
        />
        
        <View className="flex-1 px-6 items-center justify-center">
          <View className="bg-white p-6 rounded-[20px] shadow-md items-center w-full">
            <Text className="text-[24px] font-bold font-roboto text-center mb-4">
              Account Created!
            </Text>
            
            <Text className="text-base font-roboto text-center mb-6">
              A verification link has been sent to your email.
            </Text>
            
            <TouchableOpacity 
              className="bg-[#e4cac7] h-[56px] rounded-[30px] shadow-md flex-row items-center justify-center mb-4 w-full"
              onPress={() => navigation.navigate('Login')} 
            >
              <Text className="text-base font-bold font-roboto text-[#1C1C1C]">
                Continue to Login
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
}