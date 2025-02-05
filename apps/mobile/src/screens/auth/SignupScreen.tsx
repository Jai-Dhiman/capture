import React, { useState, useRef } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  TextInput,
  Alert,
  Image
} from 'react-native'
import { supabase } from '../../lib/supabase'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import * as SecureStore from 'expo-secure-store'
import EmailIcon from '../../assets/icons/Email Icon.svg'
import LockIcon from '../../assets/icons/Lock Icon.svg'
import ViewPasswordIcon from '../../assets/icons/View Password Icon.svg'
import HidePasswordIcon from '../../assets/icons/Dont Show Passoword Icon.svg'
import { useSessionStore } from '../../stores/sessionStore'

type Props = {
  navigation: NativeStackNavigationProp<any>
}

export default function SignupScreen({ navigation }: Props) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isEmailFocused, setIsEmailFocused] = useState(false)
  const [isPasswordFocused, setIsPasswordFocused] = useState(false)
  const [isConfirmPasswordFocused, setIsConfirmPasswordFocused] = useState(false)
  
  const emailInputRef = useRef<TextInput>(null)
  const passwordInputRef = useRef<TextInput>(null)
  const confirmPasswordInputRef = useRef<TextInput>(null)

  const { setAuthUser } = useSessionStore()

  const handleSignup = async () => {
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      Alert.alert('Error', 'Passwords do not match')
      return
    }

    setLoading(true)
    setError(null)
    
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      })

      if (error) throw error

      if (data.session) {
        await SecureStore.setItemAsync('supabase_jwt', data.session.access_token)
        
        // Set auth user in store
        setAuthUser({
          id: data.user!.id,
          email: data.user!.email!,
          phone: data.user!.phone || undefined,
        });

        // Since this is a new signup, we don't set userProfile
        // This will automatically make isNewUser true in the store
        navigation.navigate('CreateProfile')
      } else {
        throw new Error('Session not created - check your email for verification')
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Signup failed'
      setError(errorMessage)
      Alert.alert('Error', errorMessage)
    } finally {
      setLoading(false)
    }
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

            {error && <Text className="text-red-500 mb-4 text-center">{error}</Text>}

            <TouchableOpacity
              className="bg-[#E4CAC7] h-[56px] rounded-[30px] shadow-md justify-center mt-[29px]"
              onPress={handleSignup}
              disabled={loading}
            >
              <Text className="text-base font-bold font-roboto text-center">
                {loading ? 'Creating Account...' : 'Create Account'}
              </Text>
            </TouchableOpacity>

            <View className="items-center mt-[32px]">
              <Text className="text-base font-roboto mb-[5px]">Already have an account?</Text>
              <TouchableOpacity onPress={() => navigation.navigate('Login')}>
                <Text className="text-base font-semibold font-roboto text-[#827B85] underline">
                  Login
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}