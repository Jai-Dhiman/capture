import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  SafeAreaView,
  Image
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../../types/navigation';
import OAuth from '../../components/OAuth';
import AppleIcon from '../../assets/icons/apple.svg';
import EmailIcon from '../../assets/icons/Email Icon.svg';
import BackIcon from '../../assets/icons/Back Icon.svg';

type Props = {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'EmailSignup'>
}

export default function SignupScreen({ navigation }: Props) {
  return (
    <SafeAreaView style={{ flex: 1 }}>
      <View className="flex-1 bg-[#DCDCDE] rounded-[30px] overflow-hidden">
        <Image
          source={require('../../assets/Fluid Background Coffee.png')}
          style={{ width: '100%', height: '100%', position: 'absolute' }}
          resizeMode="cover"
        />
        
        <View className="w-[299px] h-[58px] mx-auto mt-[84px]">
          <TouchableOpacity 
            className="w-9 h-9 absolute left-[3%]"
            onPress={() => navigation.goBack()}
          >
            <View className="w-8 h-8 bg-[#DFD2CD] rounded-full shadow-md flex justify-center items-center">
              <BackIcon width={20} height={20} />
            </View>
          </TouchableOpacity>
          
          <Text className="text-[40px] font-roboto font-light text-center">
            Capture
          </Text>
          <View className="h-[1px] bg-black/10 w-full mt-2"></View>
        </View>
        <View className="px-6 mt-[120px]">

          {/* Email signup button */}
          <TouchableOpacity 
            className="bg-white h-[56px] rounded-[30px] shadow-md flex-row items-center justify-center mb-[23px]"
            onPress={() => navigation.navigate('Signup')}
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
    </SafeAreaView>
  );
}