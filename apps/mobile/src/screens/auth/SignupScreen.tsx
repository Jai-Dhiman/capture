import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../../types/navigation';
import OAuth from '../../components/OAuth';
import AppleIcon from '../../../assets/icons/AppleLogo.svg';
import EmailIcon from '../../../assets/icons/EmailIcon.svg';
import Header from '../../components/Header';

type Props = {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'EmailSignup'>
}

export default function SignupScreen({ navigation }: Props) {
  return (
    <View style={{ flex: 1 }}>
      <View className="flex-1 bg-[#DCDCDE] rounded-[30px] overflow-hidden">
        <Image
          source={require('../../../assets/DefaultBackground.png')}
          style={{ width: '100%', height: '100%', position: 'absolute' }}
          resizeMode="cover"
        />
        
        <Header 
          showBackButton={true}
          onBackPress={() => navigation.goBack()}
        />
        <View className="px-6 mt-[120px]">

          {/* Email signup button */}
          <TouchableOpacity 
            className="bg-white h-[56px] rounded-[30px] shadow-md flex-row items-center justify-center mb-[23px]"
            onPress={() => navigation.navigate('EmailSignup')}
          >
            <EmailIcon width={24} height={24} style={{ marginRight: 16 }} />
            <Text className="text-base font-bold font-roboto text-[#1C1C1C]">
              Sign Up with Email
            </Text>
          </TouchableOpacity>
          
          <OAuth />
          
          {/* Apple signup button (static for now) */}
          <TouchableOpacity 
            className="bg-white h-[56px] rounded-[30px] shadow-md flex-row items-center justify-center mb-[23px]"
          >
            <AppleIcon width={24} height={24} style={{ marginRight: 16 }} />
            <Text className="text-base font-bold font-roboto text-[#1C1C1C]">
              Sign Up with Apple
            </Text>
          </TouchableOpacity>
          
          {/* Business account button */}
          <TouchableOpacity 
            className="bg-[#827B85] h-[56px] rounded-[30px] shadow-md flex-row items-center justify-center"
          >
            <Text className="text-base font-bold font-roboto text-white">
              Create Business Account
            </Text>
          </TouchableOpacity>
        </View>
        
      </View>
    </View>
  );
}