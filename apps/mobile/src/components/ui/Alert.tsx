import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Animated, Dimensions } from 'react-native';

export type AlertType = 'error' | 'success' | 'info' | 'warning';

interface ThemedAlertProps {
  visible: boolean;
  message: string;
  type?: AlertType;
  action?: {
    label: string;
    onPress: () => void;
  };
  duration?: number;
  onDismiss?: () => void;
}

export const ThemedAlert: React.FC<ThemedAlertProps> = ({
  visible,
  message,
  type = 'info',
  action,
  duration,
  onDismiss,
}) => {
  const [fadeAnim] = useState(new Animated.Value(0));
  const [slideAnim] = useState(new Animated.Value(-100));
  const { width } = Dimensions.get('window');

  const getBgColor = () => {
    switch (type) {
      case 'error': return '#EB8B8B';
      case 'success': return '#A8D7A8';
      case 'warning': return '#F6D289';
      case 'info':
      default: return '#DEBEBE';
    }
  };

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();

      if (duration !== undefined && duration > 0) {
        const timer = setTimeout(() => {
          handleDismiss();
        }, duration);
        return () => clearTimeout(timer);
      }
    } else {
      fadeAnim.setValue(0);
      slideAnim.setValue(-100);
    }
  }, [visible, duration]);

  const handleDismiss = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: -100,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      if (onDismiss) onDismiss();
    });
  };

  if (!visible) return null;

  return (
    <Animated.View
      className="absolute top-8 left-0 right-0 z-50 px-4"
      style={{
        opacity: fadeAnim,
        transform: [{ translateY: slideAnim }],
      }}
    >
      <View 
        className="w-full rounded-[10px] p-3 shadow-md"
        style={{ backgroundColor: getBgColor() }}
      >
        <Text className="font-roboto font-normal text-black text-xs leading-[22px]">
          {message}
        </Text>
        
        {action && (
          <TouchableOpacity 
            onPress={action.onPress}
            className="self-end mt-1"
          >
            <Text className="font-roboto font-normal text-[#005DFFED] text-xs underline">
              {action.label}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </Animated.View>
  );
};