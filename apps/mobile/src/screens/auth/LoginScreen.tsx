import React, { useState, useRef } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  Image,
  Alert,
  ScrollView,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { supabase } from 'lib/supabase'
import EmailIcon from '../../assets/icons/Email Icon.svg';
import LockIcon from '../../assets/icons/Lock Icon.svg';
import ViewPasswordIcon from '../../assets/icons/View Password Icon.svg';
import HidePasswordIcon from '../../assets/icons/Dont Show Passoword Icon.svg';
import { useSessionStore } from '../../stores/sessionStore'
import { AuthStackParamList } from '../../types/navigation';
import { API_URL } from '@env';
// import OAuth from 'components/OAuth';

type Props = {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'Login'>
}

export default function LoginScreen({ navigation }: Props) {
  const [showPassword, setShowPassword] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isEmailFocused, setIsEmailFocused] = useState(false)
  const [isPasswordFocused, setIsPasswordFocused] = useState(false)
  const [loading, setLoading] = useState(false)
  const emailInputRef = useRef<TextInput>(null)
  const passwordInputRef = useRef<TextInput>(null)

  const { setAuthUser } = useSessionStore()

  const handleLogin = async () => {
    setLoading(true);
    try {
      if (!email || !password) {
        Alert.alert('Error', 'Please enter both email and password');
        return;
      }
  
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
  
      if (authError) {
        console.error("Login error:", authError);
        Alert.alert('Login Failed', authError.message);
        return;
      }
      
      if (!authData.user?.email_confirmed_at) {
        Alert.alert(
          'Email Not Verified',
          'Please check your inbox and verify your email before logging in.'
        );
        return;
      }
      
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        
        if (token) {
          const response = await fetch(`${API_URL}/api/profile/check/${authData.user.id}`, {
            headers: {
              Authorization: `Bearer ${token}`,
            }
          });
          const checkResult = await response.json();
          
          if (checkResult.exists) {
            const profileResponse = await fetch(`${API_URL}/api/profile/${authData.user.id}`, {
              headers: {
                Authorization: `Bearer ${token}`,
              }
            });
            
            if (profileResponse.ok) {
              const profileData = await profileResponse.json();
              console.log("Profile data loaded:", profileData);
              
              const { setUserProfile } = useSessionStore.getState();
              
              setUserProfile({
                id: profileData.id,
                supabase_id: authData.user.id,
                username: profileData.username,
                bio: profileData.bio || undefined,
                image: profileData.profileImage || undefined,
              });
            } else {
              console.error("Failed to load profile details:", await profileResponse.text());
            }
          }
        } else {
          console.log("No token available for profile check");
        }
      } catch (checkError) {
        console.error("Profile check error:", checkError);
      }
      
      setAuthUser({
        id: authData.user.id,
        email: authData.user.email!,
      });
    } catch (error) {
      console.error('Unexpected error:', error);
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

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
              <Text className="text-xs font-roboto underline mt-[12px]">Forgot Password?</Text>
            </View>

            <TouchableOpacity
            className="bg-[#E4CAC7] h-[56px] rounded-[30px] shadow-md justify-center mt-[59px]"
            onPress={handleLogin}
            disabled={loading}>
              <Text className="text-base font-bold font-roboto text-center">
                {loading ? 'Signing In...' : 'Login'}
              </Text>
            </TouchableOpacity>

            <View className="h-[1px] bg-[#7B7B7B] my-[29px]" />

            <View className="h-[1px] bg-[#7B7B7B] my-[29px]" />
            {/* <OAuth /> */}

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
    </SafeAreaView>
  )
}