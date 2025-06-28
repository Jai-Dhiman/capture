import { SkeletonElement } from '@/shared/components/SkeletonLoader';
import React from 'react';
import { View } from 'react-native';

export const CommentSkeleton = ({ isReply = false }) => {
  return (
    <View className={`border-t border-[#e5e5e5] ${isReply ? 'pl-16' : ''}`}>
      <View className="w-full p-4 flex flex-row items-start gap-2.5">
        <SkeletonElement width={44} height={44} radius="round" />

        <View className="flex-1 flex flex-col gap-1.5">
          <View className="flex flex-row justify-between items-center">
            <SkeletonElement width={120} height={16} />
            <SkeletonElement width={60} height={12} />
          </View>

          <View className="mt-2">
            <SkeletonElement width="100%" height={10} />
            <View style={{ marginTop: 4 }}>
              <SkeletonElement width="90%" height={10} />
            </View>
            <View style={{ marginTop: 4 }}>
              <SkeletonElement width="60%" height={10} />
            </View>
          </View>

          <View className="flex items-end mt-2">
            <SkeletonElement width={40} height={12} />
          </View>
        </View>
      </View>
    </View>
  );
};
