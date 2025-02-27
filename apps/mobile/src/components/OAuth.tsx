// import React, { useEffect } from 'react';
// import { View, TouchableOpacity, Text, Alert } from 'react-native';
// import { useNavigation } from '@react-navigation/native';
// import * as WebBrowser from 'expo-web-browser';
// import * as Google from 'expo-auth-session/providers/google';
// import * as AppleAuthentication from 'expo-apple-authentication';
// import { supabase } from 'lib/supabase';
// import { useSessionStore } from 'stores/sessionStore';
// import { checkProfileExists } from 'lib/api';
// import { GOOGLE_CLIENT_ID} from '@env';

// import GoogleIcon from '../../assets/icons/google.svg';
// import AppleIcon from '../../assets/icons/apple.svg';

// WebBrowser.maybeCompleteAuthSession();

// export default function OAuth() {
//   const navigation = useNavigation();
//   const { setAuthUser } = useSessionStore();

//   const [request, response, promptAsync] = Google.useAuthRequest({
//     expoClientId: GOOGLE_CLIENT_ID,
//     iosClientId: GOOGLE_CLIENT_ID,
//     androidClientId: GOOGLE_CLIENT_ID,
//     webClientId: GOOGLE_CLIENT_ID,
//   });

//   useEffect(() => {
//     if (response?.type === 'success') {
//       const { id_token } = response.params;
//       handleGoogleLogin(id_token);
//     }
//   }, [response]);

//   const handleGoogleLogin = async (idToken: string) => {
//     try {
//       const { data, error } = await supabase.auth.signInWithIdToken({
//         provider: 'google',
//         token: idToken,
//       });

//       if (error) throw error;

//       if (data.user) {
//         setAuthUser({
//           id: data.user.id,
//           email: data.user.email!,
//         });
        
//         const hasProfile = await checkProfileExists(data.user.id);
        
//         if (!hasProfile) {
//           navigation.navigate('CreateProfile' as never);
//         }
//       }
//     } catch (error) {
//       console.error('Google login error:', error);
//       Alert.alert('Error', 'Failed to login with Google');
//     }
//   };

//   const handleAppleLogin = async () => {
//     try {
//       const credential = await AppleAuthentication.signInAsync({
//         requestedScopes: [
//           AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
//           AppleAuthentication.AppleAuthenticationScope.EMAIL,
//         ],
//       });
      
//       if (credential.identityToken) {
//         const { data, error } = await supabase.auth.signInWithIdToken({
//           provider: 'apple',
//           token: credential.identityToken,
//         });

//         if (error) throw error;

//         if (data.user) {
//           setAuthUser({
//             id: data.user.id,
//             email: data.user.email!,
//           });
          
//           const hasProfile = await checkProfileExists(data.user.id);
          
//           if (!hasProfile) {
//             navigation.navigate('CreateProfile' as never);
//           }
//         }
//       }
//     } catch (error) {
//       console.error('Apple login error:', error);
//       if (error.code !== 'ERR_CANCELED') {
//         Alert.alert('Error', 'Failed to login with Apple');
//       }
//     }
//   };

//   return (
//     <View>
//       <TouchableOpacity 
//         className="bg-white h-[56px] rounded-[30px] shadow-md flex-row items-center justify-center mb-[23px]"
//         onPress={() => promptAsync()}
//         disabled={!request}
//       >
//         <GoogleIcon width={24} height={24} style={{ marginRight: 7 }} />
//         <Text className="text-base font-bold font-roboto text-[#1C1C1C]">
//           Continue with Google
//         </Text>
//       </TouchableOpacity>

//       {AppleAuthentication.isAvailableAsync() && (
//         <TouchableOpacity 
//           className="bg-white h-[56px] rounded-[30px] shadow-md flex-row items-center justify-center"
//           onPress={handleAppleLogin}
//         >
//           <AppleIcon width={24} height={24} style={{ marginRight: 7 }} />
//           <Text className="text-base font-bold font-roboto text-[#1C1C1C]">
//             Continue with Apple
//           </Text>
//         </TouchableOpacity>
//       )}
//     </View>
//   );
// }