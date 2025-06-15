import { useAuthStore } from '@/features/auth/stores/authStore';
import CustomBackIcon from '@assets/icons/CustomBackIcon.svg';
import CustomMenuIcon from '@assets/icons/CustomMenuIcon.svg';
import EmptyIcon from '@assets/icons/EmptyIcon.svg';
import PlusIcon from '@assets/icons/PlusIcon.svg';
import ProfileIcon from '@assets/icons/ProfileIcon.svg';
import SearchIcon from '@assets/icons/SearchIcon.svg';
import { useNavigation } from '@react-navigation/native';
import { MotiView } from 'moti';
import type React from 'react';
import { useState } from 'react';
import { ImageBackground, Modal, Pressable, Text, TouchableOpacity, View } from 'react-native';

type HeaderProps = {
  showBackButton?: boolean;
  onBackPress?: () => void;
  forceHideMenu?: boolean;
  hideHeader?: boolean;
  height?: number;
  addSpacer?: boolean;
  showBackground?: boolean;
};

const HEADER_HEIGHT = 150;

const Header: React.FC<HeaderProps> = ({
  showBackButton = false,
  onBackPress,
  forceHideMenu = false,
  hideHeader = false,
  height,
  addSpacer = true,
  showBackground = false,
}) => {
  const [menuVisible, setMenuVisible] = useState(false);
  const navigation = useNavigation<any>();
  const { stage } = useAuthStore();

  const showMenuButton = stage === 'authenticated' && !forceHideMenu;
  const headerHeight = height ?? HEADER_HEIGHT;

  const navigationItems = [
    { name: 'Feed', icon: EmptyIcon, route: 'Feed' },
    { name: 'Search', icon: SearchIcon, route: 'Search' },
    { name: 'Profile', icon: ProfileIcon, route: 'Profile' },
    { name: 'New Post', icon: PlusIcon, route: 'NewPost' },
  ];

  const toggleMenu = () => {
    setMenuVisible(!menuVisible);
  };

  const handleNavigation = (route: string) => {
    setMenuVisible(false);
    navigation.navigate(route);
  };

  return (
    <>
      {addSpacer && <View style={{ height: headerHeight }} />}
      <MotiView
        from={{ translateY: 0 }}
        animate={{ translateY: hideHeader ? -headerHeight : 0 }}
        transition={{ type: 'timing', duration: 300 }}
        className="absolute top-0 left-0 w-full z-10 bg-transparent"
        style={{ height: headerHeight, overflow: 'hidden' }}
      >
        {showBackground && (
          <ImageBackground
            source={require('@assets/DefaultBackground.png')}
            style={{
              width: '100%',
              height: '100%',
              position: 'absolute',
            }}
          />
        )}
        <View className="absolute left-0 right-0 bottom-8 flex-row items-center justify-between px-8">
          {showBackButton ? (
            <TouchableOpacity
              className="w-10 h-10 bg-[#DFD2CD] rounded-full flex justify-center items-center"
              onPress={onBackPress}
            >
              <CustomBackIcon width={30} height={30} />
            </TouchableOpacity>
          ) : (
            <View className="w-10 h-10" />
          )}
          <Text className="text-5xl font-thin text-center flex-1 font-roboto">Capture</Text>
          {showMenuButton ? (
            <TouchableOpacity
              className="w-10 h-10 bg-[#DFD2CD] rounded-full flex justify-center items-center"
              onPress={toggleMenu}
            >
              <CustomMenuIcon width={30} height={30} />
            </TouchableOpacity>
          ) : (
            <View className="w-10 h-10" />
          )}
        </View>
        {menuVisible && (
          <Modal
            transparent={true}
            visible={menuVisible}
            animationType="none"
            onRequestClose={() => setMenuVisible(false)}
          >
            <Pressable
              style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
              onPress={() => setMenuVisible(false)}
            >
              <View style={{ flex: 1 }} />
            </Pressable>

            <MotiView
              from={{ translateY: -200, opacity: 0 }}
              animate={{ translateY: menuVisible ? 0 : -200, opacity: menuVisible ? 1 : 0 }}
              transition={{ type: 'spring', damping: 15, stiffness: 100 }}
              className="absolute right-4 top-14 z-50 w-56 h-72"
            >
              <Pressable onPress={(e) => e.stopPropagation()}>
                <View className="w-56 h-72 pb-10 flex flex-col justify-start items-start gap-0.5">
                  {navigationItems.map((item) => {
                    const Icon = item.icon;
                    return (
                      <TouchableOpacity
                        key={item.route}
                        className="self-stretch h-14 relative bg-[#e4cac7] rounded-2xl shadow-sm"
                        onPress={() => handleNavigation(item.route)}
                      >
                        <Text className="left-[60px] top-[16px] absolute justify-center text-neutral-900 text-base font-base leading-normal">
                          {item.name}
                        </Text>
                        <View className="w-10 h-10 left-[8px] top-[8px] absolute bg-white rounded-xl outline outline-1 outline-offset-[-1px] outline-zinc-100 flex justify-center items-center">
                          <Icon width={22} height={22} />
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </Pressable>
            </MotiView>
          </Modal>
        )}
        {/* <View className="absolute bottom-0 self-center w-[85%] h-[0.75px] bg-neutral-700 opacity-50" /> */}
      </MotiView>
    </>
  );
};

export default Header;
