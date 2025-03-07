import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import BackIcon from '../assets/icons/Back Icon.svg';

type HeaderProps = {
  showBackButton?: boolean;
  onBackPress?: () => void;
}

const Header: React.FC<HeaderProps> = ({ 
  showBackButton = false,
  onBackPress
}) => {
  return (
    <View className="relative px-4 mt-[84px]">
      {showBackButton && (
        <TouchableOpacity 
          className="absolute left-8 top-1 z-15"
          onPress={onBackPress}
        >
          <View className="w-8 h-8 bg-[#DFD2CD] rounded-full shadow-md flex justify-center items-center">
            <BackIcon width={24} height={24} />
          </View>
        </TouchableOpacity>
      )}
      
      <View className="w-[299px] mx-auto">
        <Text className="text-[40px] font-roboto font-light text-center">
          Capture
        </Text>
        <View className="h-[1px] bg-black/10 w-full mt-2"></View>
      </View>
    </View>
  );
};

export default Header;