import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { SplashAnimation } from '../components/ui/SplashAnimation';
import { useAuthStore } from '../stores/authStore';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../components/Navigators/types/navigation';


type SplashScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList>;
};

export default function SplashScreen({ navigation }: SplashScreenProps) {
  const [animationComplete, setAnimationComplete] = useState(false);
  const { stage: authStage } = useAuthStore();
  
  useEffect(() => {
    if (animationComplete) {
      if (authStage === 'unauthenticated') {
        navigation.replace('Auth');
      } else if (authStage === 'profile-creation') {
        navigation.replace('CreateProfile');
      } else if (authStage === 'phone-verification') {
        navigation.replace('PhoneVerification');
      } else if (authStage === 'complete') {
        navigation.replace('App');
      }
    }
  }, [animationComplete, authStage, navigation]);

  return (
    <View className="flex-1 bg-white">
      <SplashAnimation 
        fullScreen={true} 
        onAnimationFinish={() => setAnimationComplete(true)} 
      />
    </View>
  );
}