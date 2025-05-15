import type React from 'react';
import { useState } from 'react';
import { View, TouchableOpacity, Text, Modal, Pressable } from 'react-native';
import { MotiView } from 'moti';
import { useUnreadNotificationCount } from '../hooks/useNotifications';
import { NotificationList } from './NotificationList';
import { useQueryClient } from '@tanstack/react-query';

interface NotificationButtonProps {
  size?: number;
}

export const NotificationButton: React.FC<NotificationButtonProps> = ({ size = 30 }) => {
  const [isOpen, setIsOpen] = useState(false);
  const { data: unreadCount = 0 } = useUnreadNotificationCount();
  const queryClient = useQueryClient();

  const toggleNotifications = () => {
    queryClient.invalidateQueries({ queryKey: ["notifications"] });
    queryClient.invalidateQueries({ queryKey: ["unreadNotificationCount"] });

    setIsOpen(!isOpen);
  };

  return (
    <>
      <TouchableOpacity
        className="w-10 h-10 bg-[#DFD2CD] rounded-full flex justify-center items-center relative"
        onPress={toggleNotifications}
      >
        <View style={{ width: size * 0.6, height: size * 0.7, borderRadius: size * 0.3, borderWidth: 2, borderColor: 'black' }}>
          <View style={{ width: size * 0.2, height: size * 0.1, backgroundColor: 'black', position: 'absolute', top: -5, alignSelf: 'center', borderRadius: 2 }} />
        </View>

        {unreadCount > 0 && (
          <View className="absolute top-0 right-0 bg-red-500 rounded-full min-w-5 h-5 flex items-center justify-center">
            <Text className="text-white text-xs font-bold">
              {unreadCount > 99 ? '99+' : unreadCount}
            </Text>
          </View>
        )}
      </TouchableOpacity>

      <Modal
        transparent={true}
        visible={isOpen}
        animationType="none"
        onRequestClose={() => setIsOpen(false)}
      >
        <Pressable
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)' }}
          onPress={() => setIsOpen(false)}
        />

        <MotiView
          from={{ translateY: -600, opacity: 0 }}
          animate={{ translateY: 0, opacity: 1 }}
          transition={{ type: 'spring', damping: 15 }}
          className="absolute top-[150px] left-0 right-0 bottom-0 bg-white rounded-t-3xl overflow-hidden"
        >
          <View className="w-12 h-1 bg-gray-300 rounded-full self-center mt-2 mb-1" />
          <NotificationList onClose={() => setIsOpen(false)} />
        </MotiView>
      </Modal>
    </>
  );
}; 