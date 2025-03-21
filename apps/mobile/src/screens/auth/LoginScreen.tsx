import React, { useState, useRef } from 'react'
import {
  View, Text, TouchableOpacity, TextInput, Image, ScrollView,
} from 'react-native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import EmailIcon from '../../../assets/icons/EmailIcon.svg'
import LockIcon from '../../../assets/icons/LockIcon.svg'
import ViewPasswordIcon from '../../../assets/icons/ViewPasswordIcon.svg'
import HidePasswordIcon from '../../../assets/icons/HidePasswordIcon.svg'
import { AuthStackParamList } from '../../components/Navigators/types/navigation'
import { useAuth } from '../../hooks/auth/useAuth'
import { LoadingSpinner } from 'components/ui/LoadingSpinner'
import OAuth from '../../components/providers/OAuth';
import Header from 'components/ui/Header'
import { useAlert } from '../../lib/AlertContext';
import { errorService } from '../../services/errorService';

type Props = {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'Login'>
}

export default function LoginScreen({ navigation }: Props) {
  const [showPassword, setShowPassword] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isEmailFocused, setIsEmailFocused] = useState(false)
  const [isPasswordFocused, setIsPasswordFocused] = useState(false)
  const emailInputRef = useRef<TextInput>(null)
  const passwordInputRef = useRef<TextInput>(null)
  const {showAlert} = useAlert()

  const { login, isLoading } = useAuth()

  const handleLogin = async () => {
    if (!email || !password) {
      showAlert('Please enter both email and password', { type: 'warning' });
      return;
    }
  
    login.mutate(
      { email, password },
      {
        onError: (error) => {
          const formattedError = errorService.handleAuthError(error);
          const alertType = errorService.getAlertType(formattedError.category);
          showAlert(formattedError.message, { type: alertType });
        }
      }
    )
  }

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <View className="flex-1 bg-[#DCDCDE] rounded-[30px] overflow-hidden">
          <Image
            source={require('../../../assets/DefaultBackground.png')}
            style={{ width: '100%', height: '100%', position: 'absolute' }}
            resizeMode="cover"
          />
          <View className="flex-1 px-[26px]">
            <Header />
            <View className="h-[1px] bg-black/10 mb-[30px]" />

            <View className="mb-[29px]">
              <Text className="text-base font-roboto mb-[6px]">Email</Text>
              <TouchableOpacity 
                activeOpacity={1}
                onPress={() => emailInputRef.current?.focus()}
                className={`bg-white h-[56px] rounded-[16px] shadow-md flex-row items-center px-[9px] ${isEmailFocused ? 'border-2 border-[#E4CAC7]' : ''}`}
              >
                <EmailIcon width={35} height={35} style={{ marginRight: 14 }} />
                <TextInput
                  ref={emailInputRef}
                  onFocus={() => setIsEmailFocused(true)}
                  onBlur={() => setIsEmailFocused(false)}
                  placeholder="johndoe@gmail.com"
                  placeholderTextColor="#C8C8C8"
                  className="flex-1 text-base font-roboto text-black outline-none"
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
              </TouchableOpacity>
            </View>

            <View>
              <Text className="text-base font-roboto mb-[6px]">Your Password</Text>
              <TouchableOpacity
                activeOpacity={1}
                onPress={() => passwordInputRef.current?.focus()}
                className={`bg-white h-[55px] rounded-[16px] shadow-md flex-row items-center px-[9px] relative ${isPasswordFocused ? 'border-2 border-[#E4CAC7]' : ''}`}
              >
                <LockIcon width={35} height={35} style={{ marginRight: 14 }} />
                <TextInput
                  ref={passwordInputRef}
                  onFocus={() => setIsPasswordFocused(true)}
                  onBlur={() => setIsPasswordFocused(false)}
                  secureTextEntry={!showPassword}
                  className="flex-1 text-base font-roboto pr-[30px] outline-none"
                  value={password}
                  onChangeText={setPassword}
                />
                <TouchableOpacity 
                  className="absolute right-[9px]"
                  onPress={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <ViewPasswordIcon width={25} height={25} />
                  ) : (
                    <HidePasswordIcon width={25} height={25} />
                  )}
                </TouchableOpacity>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => navigation.navigate('ForgotPassword')}>
                <Text className="text-xs font-roboto underline mt-[12px]">Forgot Password?</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              className="bg-[#E4CAC7] h-[56px] rounded-[30px] shadow-md justify-center mt-[59px]"
              onPress={handleLogin}
              disabled={isLoading}
            >
              {isLoading ? (
                <LoadingSpinner fullScreen message="Logging in..." />
              ) : (
                <Text className="text-base font-bold font-roboto text-center">
                  Log In
                </Text>
              )}
            </TouchableOpacity>

            <View className="h-[1px] bg-[#7B7B7B] my-[29px]" />
            <OAuth />
            <View className="h-[1px] bg-[#7B7B7B] my-[29px]" />

            <View className="items-center mt-[32px]">
              <Text className="text-base font-roboto mb-[5px]">Don't have an account?</Text>
              <TouchableOpacity onPress={() => navigation.navigate('Signup')}>
                <Text className="text-base font-semibold font-roboto text-[#827B85] underline">
                  Register
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  )
}