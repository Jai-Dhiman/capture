import { MotiView } from 'moti';
import React from 'react';
import { Dimensions, Modal, Pressable, Text, TouchableOpacity, View } from 'react-native';
import { BlockIconSvg, EmptyIconSvg, NotificationIconSvg, QuestionIconSvg, ReportIconSvg, TrashIconSvg } from '@assets/icons/svgStrings';
import { svgToDataUri } from '@/shared/utils/svgUtils';
import { Image } from 'expo-image';


interface PostMenuProps {
  isVisible: boolean;
  onClose: () => void;
  onBlockUser?: () => void;
  onReportPost?: () => void;
  onWhySeeing?: () => void;
  onEnableNotifications?: () => void;
  onDeletePost?: () => void;
  isOwnPost: boolean;
  isLoading?: boolean;
  position?: { top: number; right: number };
  buttonPosition?: { x: number; y: number };
}

export const PostMenu = ({
  isVisible,
  onClose,
  onBlockUser,
  onReportPost,
  onWhySeeing,
  onEnableNotifications,
  onDeletePost,
  isOwnPost,
  isLoading = false,
  position = { top: 50, right: 20 },
  buttonPosition,
}: PostMenuProps) => {
  const menuItems = isOwnPost
    ? [
      {
        text: isLoading ? 'Deleting...' : 'Delete Post',
        onPress: onDeletePost,
        disabled: isLoading,
        icon: TrashIconSvg,
      },
    ]
    : [
      {
        text: isLoading ? 'Blocking...' : 'Block User',
        onPress: onBlockUser,
        disabled: isLoading,
        icon: BlockIconSvg,
      },
      {
        text: 'Report Post',
        onPress: onReportPost,
        icon: ReportIconSvg,
      },
      {
        text: 'Why Am I Seeing This?',
        onPress: onWhySeeing,
        icon: QuestionIconSvg,
      },
      {
        text: 'Enable Notifications',
        onPress: onEnableNotifications,
        icon: NotificationIconSvg,
      },
    ];

  const screenWidth = Dimensions.get('window').width;

  // Calculate menu position based on button position
  const menuPosition = buttonPosition
    ? {
      top: buttonPosition.y,
      right: screenWidth - buttonPosition.x,
    }
    : position;

  const from = buttonPosition ? { translateY: -10, opacity: 0 } : { translateY: 20, opacity: 0 };

  return (
    <Modal transparent={true} visible={isVisible} animationType="none" onRequestClose={onClose}>
      <Pressable
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        onPress={onClose}
      >
        <View style={{ flex: 1 }} />
      </Pressable>

      <MotiView
        from={from}
        animate={{ translateY: 0, translateX: 0, opacity: isVisible ? 1 : 0 }}
        transition={{ type: 'spring', damping: 15, stiffness: 100 }}
        className="absolute z-50 w-56"
        style={{ top: menuPosition.top, right: menuPosition.right }}
      >
        <Pressable onPress={(e) => e.stopPropagation()}>
          <View className="w-56 pb-2 flex flex-col justify-start items-start gap-0.5">
            {menuItems.map((item) => {
              const Icon = item.icon || EmptyIconSvg;
              return (
                <TouchableOpacity
                  key={item.text}
                  className="self-stretch h-14 relative bg-[#e4cac7] rounded-2xl shadow-sm"
                  onPress={item.onPress}
                  disabled={item.disabled}
                >
                  <Text className="left-[60px] top-[16px] absolute justify-center text-neutral-900 text-base font-base leading-normal">
                    {item.text}
                  </Text>
                  <View className="w-10 h-10 left-[8px] top-[8px] absolute bg-white rounded-xl outline outline-1 outline-offset-[-1px] outline-zinc-100 flex justify-center items-center">
                    <Image
                      source={{ uri: svgToDataUri(Icon) }}
                      style={{ width: 22, height: 22 }}
                    />
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </Pressable>
      </MotiView>
    </Modal>
  );
};
