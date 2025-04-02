import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StatusBar } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SettingsStackParamList } from '../../components/Navigators/types/navigation';
import { useProfileStore } from '../../stores/profileStore'
import { ProfileImage } from '../../components/media/ProfileImage';
import EmptyIcon from '../../../assets/icons/EmptyIcon.svg';
import BlockIcon from '../../../assets/icons/BlockIcon.svg';
import AlgorithmIcon from '../../../assets/icons/AlgorithmIcon.svg';
import LockIcon2 from '../../../assets/icons/LockIcon2.svg';
import EmailIcon from '../../../assets/icons/EmailIcon.svg';
import BackIcon from '../../../assets/icons/BackIcon.svg';
import NotificationIcon from '../../../assets/icons/NotificationIcon.svg';
import CustomizeIcon from '../../../assets/icons/CustomizeIcon.svg';
import FontBookIcon from '../../../assets/icons/FontBookIcon.svg';
import ShieldIcon from '../../../assets/icons/ShieldIcon.svg';
import AccountIcon from '../../../assets/icons/AccountIcon.svg';
import UserVerifiedIcon from '../../../assets/icons/UserVerifiedIcon.svg';

type NavigationProp = NativeStackNavigationProp<SettingsStackParamList, 'MainSettings'>;

export default function MainSettingsScreen() {
  const navigation = useNavigation<NavigationProp>();
  const {profile} = useProfileStore();

  const goBack = () => {
    navigation.getParent()?.goBack();
  };
  
  return (
    <View className="flex-1 bg-zinc-300">
      <StatusBar barStyle="dark-content" />
      
      <View className="w-full pt-14 px-4 pb-4">
      <TouchableOpacity 
          className="absolute left-4 top-14 bg-stone-300 rounded-full w-8 h-8 flex items-center justify-center shadow-inner"
          onPress={goBack }
        >
          <BackIcon height={20} width={20} />
        </TouchableOpacity>
        <Text className="text-center text-4xl font-medium">Settings</Text>
      </View>
      
      <ScrollView className="flex-1 px-4">
        <TouchableOpacity 
          className="flex-row items-center bg-stone-400 rounded-full p-4 mb-6 shadow"
          onPress={() => navigation.navigate('AccountSettings')}
        >
          <View className="w-14 h-14 rounded-full overflow-hidden shadow-sm">
            {profile?.profileImage ? (
              <ProfileImage cloudflareId={profile.profileImage} />
            ) : (
              <View className="w-full h-full bg-stone-300" />
            )}
          </View>
          
          <View className="ml-4">
            <Text className="text-sm font-semibold">{profile?.username || 'User'}</Text>
            <Text className="text-xs text-black opacity-70">
              Password & Security, Verification, Account Information
            </Text>
          </View>
        </TouchableOpacity>
        
        <View className="bg-stone-400 bg-opacity-0 rounded-[10px] shadow border border-black mb-6">
          <TouchableOpacity 
            className="flex-row items-center p-3 border-b border-black border-opacity-20"
            onPress={() => navigation.navigate('BlockedUsers')}
          >
            <BlockIcon height={25} width={25} />
            <Text className="ml-4 text-xs font-bold">Blocked Profiles</Text>
            <View className="flex-1" />
            <EmptyIcon height={20} width={20} />
          </TouchableOpacity>
          
          <TouchableOpacity className="flex-row items-center p-3 border-b border-black border-opacity-20">
            <EmailIcon height={25} width={25} />
            <Text className="ml-4 text-xs font-bold">Private Messaging Preferences</Text>
            <View className="flex-1" />
            <EmptyIcon height={20} width={20} />
          </TouchableOpacity>
          
          <TouchableOpacity className="flex-row items-center p-3 border-b border-black border-opacity-20">
            <AlgorithmIcon height={25} width={25} />
            <Text className="ml-4 text-xs font-bold">Algorithm Preferences</Text>
            <View className="flex-1" />
            <EmptyIcon height={20} width={20} />
          </TouchableOpacity>
          
          <TouchableOpacity className="flex-row items-center p-3">
            <LockIcon2 height={25} width={25} />
            <Text className="ml-4 text-xs font-bold">Data & Privacy Policy</Text>
            <View className="flex-1" />
            <EmptyIcon height={20} width={20} />
          </TouchableOpacity>
        </View>
        
        {/* Customization Section */}
        <View className="bg-white bg-opacity-0 rounded-[10px] shadow border border-black mb-6">
          <TouchableOpacity className="flex-row items-center p-3 border-b border-black border-opacity-20">
            <NotificationIcon height={25} width={25} />
            <Text className="ml-4 text-xs font-bold">Notification Customization</Text>
            <View className="flex-1" />
            <EmptyIcon height={20} width={20} />
          </TouchableOpacity>
          
          <TouchableOpacity className="flex-row items-center p-3 border-b border-black border-opacity-20">
            <CustomizeIcon height={25} width={25} />
            <Text className="ml-4 text-xs font-bold">Appearance & Customization</Text>
            <View className="flex-1" />
            <EmptyIcon height={20} width={20} />
          </TouchableOpacity>
          
          <TouchableOpacity className="flex-row items-center p-3 border-b border-black border-opacity-20" disabled={true}>
            <FontBookIcon height={25} width={25} />
            <View className="ml-4">
              <Text className="text-xs font-bold">Font Customization</Text>
              <Text className="text-[10px] text-black opacity-70">
                This option is locked and will be available in a future update
              </Text>
            </View>
            <View className="flex-1" />
            <EmptyIcon height={20} width={20} />
          </TouchableOpacity>
          
          <TouchableOpacity className="flex-row items-center p-3" disabled={true}>
            <EmptyIcon height={25} width={25} />
            <View className="ml-4">
              <Text className="text-xs font-bold">Business Account Customization</Text>
              <Text className="text-[10px] text-black opacity-70">
                This option is locked and will be available for verified businesses
              </Text>
            </View>
            <View className="flex-1" />
            <EmptyIcon height={20} width={20} />
          </TouchableOpacity>
        </View>
        
        <Text className="text-center text-[10px] opacity-70 mb-4">
          More customization features will be available as the application gets updated. 
          Stay tuned to @Capture for more information on what you can expect and when
        </Text>
        
        {/* Support Section */}
        <View className="bg-white bg-opacity-0 rounded-[10px] shadow border border-black mb-8">
          <TouchableOpacity className="flex-row items-center p-3 border-b border-black border-opacity-20">
            <ShieldIcon height={25} width={25} />
            <Text className="ml-4 text-xs font-bold">Report User</Text>
            <View className="flex-1" />
            <EmptyIcon height={20} width={20} />
          </TouchableOpacity>
          
          <TouchableOpacity className="flex-row items-center p-3 border-b border-black border-opacity-20">
            <AccountIcon height={25} width={25} />
            <Text className="ml-4 text-xs font-bold">Report Bug</Text>
            <View className="flex-1" />
            <EmptyIcon height={20} width={20} />
          </TouchableOpacity>
          
          <TouchableOpacity className="flex-row items-center p-3">
            <UserVerifiedIcon height={25} width={25} />
            <Text className="ml-4 text-xs font-bold">Feature Request</Text>
            <View className="flex-1" />
            <EmptyIcon height={20} width={20} />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
};