import React, { useState, useRef } from 'react'
import {
  View, Text, TouchableOpacity, SafeAreaView, ScrollView, TextInput, Alert, Image
} from 'react-native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import EmailIcon from '../../assets/icons/Email Icon.svg'
import LockIcon from '../../assets/icons/Lock Icon.svg'
import ViewPasswordIcon from '../../assets/icons/View Password Icon.svg'
import HidePasswordIcon from '../../assets/icons/Dont Show Passoword Icon.svg'
import { AuthStackParamList } from '../../types/navigation'
import { useAuth } from '../../hooks/auth/useAuth'
import { LoadingSpinner } from 'components/LoadingSpinner'
import OAuth from '../../components/OAuth';

type Props = {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'Signup'>
}

export default function EmailSignupScreen({ navigation }: Props) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isEmailFocused, setIsEmailFocused] = useState(false)
  const [isPasswordFocused, setIsPasswordFocused] = useState(false)
  const [isConfirmPasswordFocused, setIsConfirmPasswordFocused] = useState(false)
  const [signupSuccess, setSignupSuccess] = useState(false)
  
  const emailInputRef = useRef<TextInput>(null)
  const passwordInputRef = useRef<TextInput>(null)
  const confirmPasswordInputRef = useRef<TextInput>(null)

  const { signup, loading } = useAuth()

  const handleSignup = async () => {
    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match')
      return
    }

    signup.mutate(
      { email, password },
      {
        onSuccess: () => {
          setSignupSuccess(true)
        },
        onError: (error) => {
          const errorMessage = error instanceof Error 
            ? error.message 
            : 'An unexpected error occurred'
          
          Alert.alert('Signup Failed', errorMessage)
        }
      }
    )
  }

  if (signupSuccess) {
    return (
      <SafeAreaView style={{ flex: 1 }}>
        <View className="flex-1 bg-[#DCDCDE] justify-center items-center px-6">
          <Image
            source={require('../../assets/Fluid Background Coffee.png')}
            style={{ width: '100%', height: '100%', position: 'absolute' }}
            resizeMode="cover"
          />
          <View className="bg-white/90 rounded-3xl p-8 items-center shadow-lg">
            <Text className="text-[30px] font-roboto font-medium text-center mb-6">
              Account Created Successfully!
            </Text>
            <Text className="text-lg font-roboto text-center mb-8">
              Please check your email for a verification link to finish creating your profile.
            </Text>
            <Text className="text-base font-roboto text-center text-gray-600 mb-8">
              You can safely leave this page.
            </Text>
            <TouchableOpacity
              className="bg-[#E4CAC7] w-full h-[56px] rounded-[30px] shadow-md justify-center mb-4"
              onPress={() => navigation.navigate('Login')}
            >
              <Text className="text-base font-bold font-roboto text-center">
                Go to Login
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <View className="flex-1 bg-[#DCDCDE] rounded-[30px] overflow-hidden">
          <Image
            source={require('../../assets/Fluid Background Coffee.png')}
            style={{ width: '100%', height: '100%', position: 'absolute' }}
            resizeMode="cover"
          />
          <View className="flex-1 px-[26px]">
            <Text className="text-[40px] font-roboto font-light text-center mt-[84px] mb-[26px]">
              Capture
            </Text>
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

            <View className="mb-[29px]">
              <Text className="text-base font-roboto mb-[6px]">Password</Text>
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
            </View>

            <View className="mb-[29px]">
              <Text className="text-base font-roboto mb-[6px]">Confirm Password</Text>
              <TouchableOpacity
                activeOpacity={1}
                onPress={() => confirmPasswordInputRef.current?.focus()}
                className={`bg-white h-[55px] rounded-[16px] shadow-md flex-row items-center px-[9px] relative ${isConfirmPasswordFocused ? 'border-2 border-[#E4CAC7]' : ''}`}
              >
                <LockIcon width={35} height={35} style={{ marginRight: 14 }} />
                <TextInput
                  ref={confirmPasswordInputRef}
                  onFocus={() => setIsConfirmPasswordFocused(true)}
                  onBlur={() => setIsConfirmPasswordFocused(false)}
                  secureTextEntry={!showConfirmPassword}
                  className="flex-1 text-base font-roboto pr-[30px] outline-none"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                />
                <TouchableOpacity 
                  className="absolute right-[9px]"
                  onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? (
                    <ViewPasswordIcon width={25} height={25} />
                  ) : (
                    <HidePasswordIcon width={25} height={25} />
                  )}
                </TouchableOpacity>
              </TouchableOpacity>
            </View>

            {signup.error && <Text className="text-red-500 mb-4 text-center">{signup.error.message}</Text>}

            <TouchableOpacity
              className="bg-[#E4CAC7] h-[56px] rounded-[30px] shadow-md justify-center mt-[29px]"
              onPress={handleSignup}
              disabled={loading}
            >
              {loading ? (
                <LoadingSpinner fullScreen message="Creating account..." />
              ) : (
                <Text className="text-base font-bold font-roboto text-center">
                  Sign Up
                </Text>
              )}
            </TouchableOpacity>

            <View className="items-center mt-[32px]">
              <Text className="text-base font-roboto mb-[5px]">Already have an account?</Text>
              <TouchableOpacity onPress={() => navigation.navigate('Login')}>
                <Text className="text-base font-semibold font-roboto text-[#827B85] underline">
                  Login
                </Text>
              </TouchableOpacity>
              
              <View className="h-[1px] bg-[#7B7B7B] my-[29px]" />
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}