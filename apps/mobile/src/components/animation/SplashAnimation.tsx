import React from 'react';
import { View } from 'react-native';
import LottieView from 'lottie-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type SplashAnimationProps = {
  fullScreen?: boolean;
};

export const SplashAnimation: React.FC<SplashAnimationProps> = ({ fullScreen = true }) => {
  const insets = useSafeAreaInsets();
  
  return (
    <View 
      className={`items-center justify-center bg-white ${fullScreen ? 'flex-1 absolute inset-0 z-50' : ''}`}
      style={fullScreen ? { paddingTop: insets.top, paddingBottom: insets.bottom } : {}}
    >
      <LottieView
        source={require('../../../assets/StartupAnimation.json')}
        autoPlay
        loop
        style={{ width: 200, height: 200 }}
      />
    </View>
  );
};