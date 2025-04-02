import React from 'react';
import { View, Text, Modal, TouchableOpacity } from 'react-native';

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
}: PostMenuProps) => {
  return (
    <Modal
      visible={isVisible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        className="flex-1 bg-black/50 justify-center items-center"
        activeOpacity={1}
        onPress={onClose}
      >
        <View className="w-[240px] bg-stone-300 rounded-2xl overflow-hidden">
          {isOwnPost ? (
            <TouchableOpacity
              className="h-14 flex-row items-center border-b border-black/10"
              onPress={onDeletePost}
              disabled={isLoading}
            >
              <View className="w-10 h-10 ml-2 mr-3 bg-white rounded-xl justify-center items-center border border-gray-100">
                <View className="w-4 h-4 justify-center items-center">
                  {/* Delete icon */}
                </View>
              </View>
              <Text className="text-base font-medium text-stone-900">
                {isLoading ? 'Deleting...' : 'Delete Post'}
              </Text>
            </TouchableOpacity>
          ) : (
            <>
              <TouchableOpacity
                className="h-14 flex-row items-center border-b border-black/10"
                onPress={onBlockUser}
                disabled={isLoading}
              >
                <View className="w-10 h-10 ml-2 mr-3 bg-white rounded-xl justify-center items-center border border-gray-100">
                  <View className="w-4 h-4 justify-center items-center">
                    {/* Block icon */}
                  </View>
                </View>
                <Text className="text-base font-medium text-stone-900">
                  {isLoading ? 'Blocking...' : 'Block User'}
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                className="h-14 flex-row items-center border-b border-black/10"
                onPress={onReportPost}
              >
                <View className="w-10 h-10 ml-2 mr-3 bg-white rounded-xl justify-center items-center border border-gray-100">
                  <View className="w-4 h-4 justify-center items-center">
                    {/* Report icon */}
                  </View>
                </View>
                <Text className="text-base font-medium text-stone-900">
                  Report Post
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                className="h-14 flex-row items-center border-b border-black/10"
                onPress={onWhySeeing}
              >
                <View className="w-10 h-10 ml-2 mr-3 bg-white rounded-xl justify-center items-center border border-gray-100">
                  <View className="w-4 h-4 justify-center items-center">
                    {/* Question icon */}
                  </View>
                </View>
                <Text className="text-base font-medium text-stone-900">
                  Why Am I Seeing This?
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                className="h-14 flex-row items-center border-b border-black/10"
                onPress={onEnableNotifications}
              >
                <View className="w-10 h-10 ml-2 mr-3 bg-white rounded-xl justify-center items-center border border-gray-100">
                  <View className="w-4 h-4 justify-center items-center">
                    {/* Notification icon */}
                  </View>
                </View>
                <Text className="text-base font-medium text-stone-900">
                  Enable Notifications
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </TouchableOpacity>
    </Modal>
  );
};