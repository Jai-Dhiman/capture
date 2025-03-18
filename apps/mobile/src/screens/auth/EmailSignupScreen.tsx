import React, { useState, useRef } from 'react'
import {
  View, Text, TouchableOpacity, ScrollView, TextInput, Image, Dimensions
} from 'react-native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { AuthStackParamList } from '../../components/Navigators/types/navigation'
import { useAuth } from '../../hooks/auth/useAuth'
import { LoadingSpinner } from 'components/ui/LoadingSpinner'
import Header from '../../components/ui/Header'
import { Feather, MaterialIcons } from '@expo/vector-icons'
import { useAlert } from '../../lib/AlertContext';
import { errorService } from '../../services/errorService';

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
  const {showAlert} = useAlert()
  
  const emailInputRef = useRef<TextInput>(null)
  const passwordInputRef = useRef<TextInput>(null)
  const confirmPasswordInputRef = useRef<TextInput>(null)

  const screenWidth = Dimensions.get('window').width
  const inputWidth = Math.min(343, screenWidth - 40) 
  const { signup, isLoading } = useAuth()

  const handleSignup = async () => {
    if (password !== confirmPassword) {
      showAlert('Passwords do not match', { type: 'warning' });
      return;
    }
  
    signup.mutate(
      { email, password },
      {
        onSuccess: () => {
          showAlert(
            'Account Created Successfully! Please check your email for a verification link to complete your registration.',
            { 
              type: 'success',
              action: {
                label: 'Go to Login',
                onPress: () => navigation.navigate('Login')
              },
              duration: 5000
            }
          );
        },
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
        <View className="flex-1 bg-[#DCDCDE] overflow-hidden">
          <Image
            source={require('../../../assets/DefaultBackground.png')}
            style={{ width: '100%', height: '100%', position: 'absolute' }}
            resizeMode="cover"
          />

          <Header 
          showBackButton={true}
          onBackPress={() => navigation.goBack()}
        />

          {/* Form Container */}
          <View className="flex-1 px-5 items-center">
            {/* Email Field */}
            <View className="mt-12 mb-4 w-full items-center">
              <TouchableOpacity 
                activeOpacity={1}
                onPress={() => emailInputRef.current?.focus()}
                style={{ width: inputWidth }}
                className="h-[55px] bg-white rounded-2xl shadow-[0px_4px_4px_0px_rgba(0,0,0,0.25)]"
              >
                <View className="w-[55px] h-[55px] absolute left-0 top-0 bg-white border border-[#c7c7c7] rounded-l-2xl" />
                <View className="absolute left-[12px] top-[12px]">
                  <MaterialIcons name="email" size={30} color="black" />
                </View>
                <TextInput
                  ref={emailInputRef}
                  onFocus={() => setIsEmailFocused(true)}
                  onBlur={() => setIsEmailFocused(false)}
                  className="absolute left-[65px] top-[20px] right-[12px] text-base font-semibold font-roboto"
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  placeholder="Email"
                  placeholderTextColor="#c7c7c7"
                />
              </TouchableOpacity>
            </View>

            {/* Password Field */}
            <View className="mb-4 w-full items-center">
              <TouchableOpacity
                activeOpacity={1}
                onPress={() => passwordInputRef.current?.focus()}
                style={{ width: inputWidth }}
                className="h-[55px] bg-white rounded-2xl shadow-[0px_4px_4px_0px_rgba(0,0,0,0.25)]"
              >
                <View className="w-[55px] h-[55px] absolute left-0 top-0 bg-white border border-[#c7c7c7] rounded-l-2xl" />
                <View className="absolute left-[12px] top-[12px]">
                  <Feather name="lock" size={30} color="black" />
                </View>
                <TextInput
                  ref={passwordInputRef}
                  onFocus={() => setIsPasswordFocused(true)}
                  onBlur={() => setIsPasswordFocused(false)}
                  className="absolute left-[64px] top-[20px] right-[40px] text-base font-semibold font-roboto"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  placeholder="Create Password"
                  placeholderTextColor="#c7c7c7"
                />
                <TouchableOpacity 
                  className="absolute right-[12px] top-[12px]"
                  onPress={() => setShowPassword(!showPassword)}
                >
                  <Feather name={showPassword ? "eye" : "eye-off"} size={24} color="#888" />
                </TouchableOpacity>
              </TouchableOpacity>
            </View>

            {/* Confirm Password Field */}
            <View className="mb-1 w-full items-center">
              <TouchableOpacity
                activeOpacity={1}
                onPress={() => confirmPasswordInputRef.current?.focus()}
                style={{ width: inputWidth }}
                className="h-[55px] bg-white rounded-2xl shadow-[0px_4px_4px_0px_rgba(0,0,0,0.25)]"
              >
                <View className="w-[55px] h-[55px] absolute left-0 top-0 bg-white border border-[#c7c7c7] rounded-l-2xl" />
                <View className="absolute left-[12px] top-[12px]">
                  <Feather name="lock" size={30} color="black" />
                </View>
                <TextInput
                  ref={confirmPasswordInputRef}
                  onFocus={() => setIsConfirmPasswordFocused(true)}
                  onBlur={() => setIsConfirmPasswordFocused(false)}
                  className="absolute left-[65px] top-[20px] right-[40px] text-base font-semibold font-roboto"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!showConfirmPassword}
                  placeholder="Re-enter Password"
                  placeholderTextColor="#c7c7c7"
                />
                <TouchableOpacity 
                  className="absolute right-[12px] top-[12px]"
                  onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  <Feather name={showConfirmPassword ? "eye" : "eye-off"} size={24} color="#888" />
                </TouchableOpacity>
              </TouchableOpacity>
            </View>

            {/* Password requirements */}
            <View className="w-full px-2 mb-6" style={{ width: inputWidth }}>
              <Text className="text-[11px] font-normal font-roboto leading-normal">
                Password must contain {"\n"}
                At least 1 Capital Letter{"\n"}
                At least 1 Number{"\n"}
                At least 1 Special Character (@$&!)
              </Text>
            </View>

            {/* Sign Up Button */}
            <TouchableOpacity
              style={{ width: inputWidth }}
              className="h-14 bg-[#e4cac7] rounded-[30px] shadow-[0px_4px_4px_0px_rgba(0,0,0,0.25)] backdrop-blur-sm justify-center items-center mt-4"
              onPress={handleSignup}
              disabled={isLoading}
            >
              {isLoading ? (
                <LoadingSpinner fullScreen message="Creating account..." />
              ) : (
                <Text className="text-center text-black text-base font-bold font-roboto leading-normal">
                  Create Account
                </Text>
              )}
            </TouchableOpacity>

          </View>
        </View>
      </ScrollView>
    </View>
  )
}