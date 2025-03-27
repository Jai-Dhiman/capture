import React, { useRef, useEffect } from 'react';
import { View } from 'react-native';
import LottieView from 'lottie-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type SplashAnimationProps = {
  fullScreen?: boolean;
  onAnimationFinish?: () => void;
};

export const SplashAnimation: React.FC<SplashAnimationProps> = ({ 
  fullScreen = true, 
  onAnimationFinish 
}) => {
  const insets = useSafeAreaInsets();
  const animationRef = useRef<LottieView>(null);
  
  useEffect(() => {
    if (animationRef.current) {
      setTimeout(() => {
        animationRef.current?.play();
      }, 100);
    }
  }, []);
  
  return (
    <View 
      className={`items-center justify-center bg-white ${fullScreen ? 'flex-1 absolute inset-0 z-50' : ''}`}
      style={fullScreen ? { paddingTop: insets.top, paddingBottom: insets.bottom } : {}}
    >
      <LottieView
        ref={animationRef}
        source={require('../../../assets/StartupAnimation.json')}
        autoPlay={false} 
        loop={false}
        style={{ width: 200, height: 200 }}
        onAnimationFinish={onAnimationFinish}
      />
    </View>
  );
};