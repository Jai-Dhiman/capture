import React, { useState, useRef } from 'react'
import {
  View, Text, TouchableOpacity, ScrollView, TextInput, Alert, Image, Dimensions
} from 'react-native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { AuthStackParamList } from '../../components/Navigators/types/navigation'
import { useSessionStore } from '../../stores/sessionStore'
import { LoadingSpinner } from 'components/LoadingSpinner'
import Header from '../../components/Header'
import { Feather, MaterialIcons } from '@expo/vector-icons'
import { supabase } from '../../lib/supabase'

type Props = {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'EnterPhone'>
}

export default function EnterPhoneScreen({ navigation }: Props) {
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [isPhoneFocused, setIsPhoneFocused] = useState(false)
  const { authUser, setAuthUser } = useSessionStore()
  
  const phoneInputRef = useRef<TextInput>(null)
  const screenWidth = Dimensions.get('window').width
  const inputWidth = Math.min(343, screenWidth - 40)

  const handleSubmitPhone = async () => {
    if (!phone || phone.length < 10) {
      Alert.alert('Error', 'Please enter a valid phone number')
      return
    }

    setLoading(true)
    try {
      const formattedPhone = `+1${phone.replace(/\D/g, '')}`
      
      // Update the user with phone number in Supabase
      const { error } = await supabase.auth.updateUser({
        phone: formattedPhone
      })
      
      if (error) throw error

      // Send OTP via Twilio integration
      const { error: otpError } = await supabase.auth.signInWithOtp({
        phone: formattedPhone,
      })
      
      if (otpError) throw otpError
      
      // Update local state
      if (authUser) {
        setAuthUser({
          ...authUser,
          phone: formattedPhone
        })
      }
      
      // Navigate to verification screen
      navigation.navigate('VerifyPhoneNumber')
    } catch (error) {
      const errorMessage = error instanceof Error 
        ? error.message 
        : 'Failed to send verification code'
      
      Alert.alert('Error', errorMessage)
    } finally {
      setLoading(false)
    }
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

          <View className="flex-1 px-5 items-center">
            <Text className="text-[32px] font-roboto text-center mt-12 mb-6">
              Enter Your Phone Number
            </Text>
            
            <Text className="text-base font-roboto text-center mb-8">
              We'll send a verification code to this number to confirm your identity.
            </Text>

            {/* Phone number field */}
            <View className="mb-8 w-full items-center">
              <TouchableOpacity 
                activeOpacity={1}
                onPress={() => phoneInputRef.current?.focus()}
                style={{ width: inputWidth }}
                className="h-[55px] bg-white rounded-2xl shadow-[0px_4px_4px_0px_rgba(0,0,0,0.25)]"
              >
                <View className="w-[55px] h-[55px] absolute left-0 top-0 bg-white border border-[#c7c7c7] rounded-l-2xl" />
                <Text className="absolute left-[16px] top-[18px] text-xl font-roboto">+1</Text>
                <TextInput
                  ref={phoneInputRef}
                  onFocus={() => setIsPhoneFocused(true)}
                  onBlur={() => setIsPhoneFocused(false)}
                  className="absolute left-[65px] top-[20px] right-[12px] text-base font-semibold font-roboto"
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  placeholder="Phone Number"
                  placeholderTextColor="#c7c7c7"
                  maxLength={10}
                />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={{ width: inputWidth }}
              className="h-14 bg-[#e4cac7] rounded-[30px] shadow-[0px_4px_4px_0px_rgba(0,0,0,0.25)] backdrop-blur-sm justify-center items-center mt-4"
              onPress={handleSubmitPhone}
              disabled={loading}
            >
              {loading ? (
                <LoadingSpinner fullScreen message="Sending verification code..." />
              ) : (
                <Text className="text-center text-black text-base font-bold font-roboto leading-normal">
                  Send Verification Code
                </Text>
              )}
            </TouchableOpacity>

            {/* Home indicator */}
            <View className="w-full absolute bottom-0 flex justify-center items-center py-2">
              <View className="w-[139px] h-[5px] bg-black rounded-[100px]" />
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  )
}