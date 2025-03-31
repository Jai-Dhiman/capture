import React from 'react';
import { View, Dimensions } from 'react-native';
import SkeletonContent from 'react-native-skeleton-content';

const { width } = Dimensions.get('window');

export const ProfileHeaderSkeleton = () => (
  <SkeletonContent
    containerStyle={{ width: "100%", padding: 16 }}
    isLoading={true}
    layout={[
      { flexDirection: "row", children: [
        { width: 90, height: 90, borderRadius: 45 },
        { marginLeft: 16, children: [
          { width: 150, height: 24, marginBottom: 8 },
          { width: 200, height: 16, marginBottom: 16 },
          { flexDirection: "row", children: [
            { width: 100, height: 32, marginRight: 8, borderRadius: 16 },
            { width: 100, height: 32, borderRadius: 16 }
          ]}
        ]}
      ]}
    ]}
  />
);

export const PostGridSkeleton = () => {
  const itemSize = (width - 32 - 16) / 3;
  
  return (
    <SkeletonContent
      containerStyle={{ width: "100%", padding: 16 }}
      isLoading={true}
      layout={[
        { flexDirection: "row", width: "100%", marginBottom: 8, children: [
          { width: itemSize, height: itemSize, marginRight: 8, borderRadius: 10 },
          { width: itemSize, height: itemSize, marginRight: 8, borderRadius: 10 },
          { width: itemSize, height: itemSize, borderRadius: 10 }
        ]},
        { flexDirection: "row", width: "100%", marginBottom: 8, children: [
          { width: itemSize, height: itemSize, marginRight: 8, borderRadius: 10 },
          { width: itemSize, height: itemSize, marginRight: 8, borderRadius: 10 },
          { width: itemSize, height: itemSize, borderRadius: 10 }
        ]}
      ]}
    />
  );
};

export const ThreadSkeleton = () => (
  <SkeletonContent
    containerStyle={{ width: "100%", padding: 16 }}
    isLoading={true}
    layout={[
      { width: "100%", height: 150, marginBottom: 16, borderRadius: 10 },
      { width: "100%", height: 150, marginBottom: 16, borderRadius: 10 },
      { width: "100%", height: 150, marginBottom: 16, borderRadius: 10 }
    ]}
  />
);

export const FeedItemSkeleton = () => (
  <SkeletonContent
    containerStyle={{ width: "100%", padding: 16 }}
    isLoading={true}
    layout={[
      { width: "100%", height: 250, marginBottom: 20, borderRadius: 10 },
      { width: "100%", height: 250, marginBottom: 20, borderRadius: 10 }
    ]}
  />
);

export const UserListSkeleton = () => (
  <SkeletonContent
    containerStyle={{ width: "100%" }}
    isLoading={true}
    layout={[
      { flexDirection: "row", alignItems: "center", marginBottom: 16, children: [
        { width: 50, height: 50, borderRadius: 25, marginRight: 16 },
        { width: 180, height: 20 }
      ]},
      { flexDirection: "row", alignItems: "center", marginBottom: 16, children: [
        { width: 50, height: 50, borderRadius: 25, marginRight: 16 },
        { width: 150, height: 20 }
      ]},
      { flexDirection: "row", alignItems: "center", marginBottom: 16, children: [
        { width: 50, height: 50, borderRadius: 25, marginRight: 16 },
        { width: 200, height: 20 }
      ]},
      { flexDirection: "row", alignItems: "center", marginBottom: 16, children: [
        { width: 50, height: 50, borderRadius: 25, marginRight: 16 },
        { width: 160, height: 20 }
      ]}
    ]}
  />
);