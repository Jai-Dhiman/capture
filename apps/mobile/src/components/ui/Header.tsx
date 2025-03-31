import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, Modal, Pressable } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useNavigation } from '@react-navigation/native';
import { useAuthStore } from '../../stores/authStore';
import BackIcon from '../../../assets/icons/BackIcon.svg';
import MenuDots from '../../../assets/icons/MenuDots.svg';
import ProfileIcon from '../../../assets/icons/ProfileIcon.svg';
import PlusIcon from '../../../assets/icons/PlusIcon.svg';
import SearchIcon from '../../../assets/icons/SearchIcon.svg';
import EmptyIcon from '../../../assets/icons/EmptyIcon.svg';

type HeaderProps = {
  showBackButton?: boolean;
  onBackPress?: () => void;
  forceHideMenu?: boolean;
}

const Header: React.FC<HeaderProps> = ({ 
  showBackButton = false,
  onBackPress,
  forceHideMenu = false
}) => {
  const [menuVisible, setMenuVisible] = useState(false);
  const navigation = useNavigation();
  const { stage } = useAuthStore();
  
  const menuAnimValue = useSharedValue(0);
  
  const showMenuButton = stage === 'complete' && !forceHideMenu;

  const navigationItems = [
    { name: 'Feed', icon: EmptyIcon, route: 'Feed' },
    { name: 'Search', icon: SearchIcon, route: 'Search' },
    { name: 'Profile', icon: ProfileIcon, route: 'Profile' },
    { name: 'New Post', icon: PlusIcon, route: 'NewPost' },
  ];

  const toggleMenu = () => {
    const newValue = menuVisible ? 0 : 1;
    menuAnimValue.value = withSpring(newValue, { damping: 15, stiffness: 100 });
    setMenuVisible(!menuVisible);
  };

  const handleNavigation = (route: string) => {
    setMenuVisible(false);
    menuAnimValue.value = 0;
    // @ts-ignore 
    navigation.navigate(route);
  };

  const menuAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateY: -200 + (menuAnimValue.value * 200) }],
      opacity: menuAnimValue.value,
    };
  });

  return (
    <View className="relative px-4 mt-[50px]">
      <View className="flex-row items-center justify-between">
        {showBackButton ? (
          <TouchableOpacity 
            className="w-8 h-8 bg-[#E4CAC7] rounded-full shadow-md flex justify-center items-center"
            onPress={onBackPress}
          >
            <BackIcon width={24} height={24} />
          </TouchableOpacity>
        ) : (
          <View className="w-8 h-8" />
        )}
        
        <View>
          <Text className="text-[40px] font-roboto font-light text-center">
            Capture
          </Text>
        </View>
        
        {showMenuButton ? (
          <TouchableOpacity 
            className="w-8 h-8 bg-[#E4CAC7] rounded-full shadow-md flex justify-center items-center"
            onPress={toggleMenu}
          >
            <MenuDots width={24} height={24} />
          </TouchableOpacity>
        ) : (
          <View className="w-8 h-8" />
        )}
      </View>
      
      <View className="h-[1px] bg-black/10 w-full mt-2"></View>
      
      {menuVisible && (
        <Modal
          transparent={true}
          visible={menuVisible}
          animationType="none"
          onRequestClose={() => setMenuVisible(false)}
        >
          <Pressable 
            style={StyleSheet.absoluteFill}
            onPress={() => setMenuVisible(false)}
          >
            <View style={{ flex: 1 }} />
          </Pressable>
          
          <Animated.View 
            style={[
              styles.menuContainer,
              menuAnimatedStyle,
            ]}
          >
            <Pressable onPress={(e) => e.stopPropagation()}>
              <View className="w-56 h-72 shadow-[0px_4px_4px_0px_rgba(0,0,0,0.25)] flex flex-col justify-start items-start">
                <View className="w-56 h-72 pb-10 flex flex-col justify-start items-start gap-0.5">
                  {navigationItems.map((item, index) => {
                    const Icon = item.icon;
                    return (
                      <TouchableOpacity
                        key={index}
                        className="self-stretch h-14 relative bg-stone-300 rounded-2xl"
                        onPress={() => handleNavigation(item.route)}
                      >
                        <Text className="left-[60px] top-[16px] absolute justify-center text-neutral-900 text-base font-medium font-['Inter'] leading-normal">
                          {item.name}
                        </Text>
                        <View className="w-10 h-10 left-[8px] top-[8px] absolute bg-white rounded-xl outline outline-1 outline-offset-[-1px] outline-zinc-100 flex justify-center items-center">
                          <Icon width={16} height={16} />
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </Pressable>
          </Animated.View>
        </Modal>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  menuContainer: {
    position: 'absolute',
    right: 16,
    top: 120,
    zIndex: 9999,
    ...(Platform.OS === 'ios' 
      ? { 
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.25,
          shadowRadius: 4,
        } 
      : {}
    ),
  },
});

export default Header;