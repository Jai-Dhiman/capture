import { Skeleton } from 'moti/skeleton';
import type React from 'react';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

interface SkeletonLoaderProps {
  isLoading: boolean;
  children: ReactNode;
  colorMode?: 'light' | 'dark';
}

type MotiSize = number | `${number}%`;
type MotiRadius = number | 'round' | 'square';

interface SkeletonElementProps {
  width?: MotiSize;
  height?: MotiSize;
  radius?: MotiRadius;
  colorMode?: 'light' | 'dark';
}

export const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({ isLoading, children }) => {
  if (!isLoading) {
    return <>{children}</>;
  }

  return (
    <Skeleton.Group show={isLoading}>
      <View style={styles.container}>{children}</View>
    </Skeleton.Group>
  );
};

export const SkeletonElement: React.FC<SkeletonElementProps> = ({
  width,
  height = 20,
  radius = 4,
  colorMode = 'light',
}) => <Skeleton width={width} height={height} radius={radius} colorMode={colorMode} />;

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
});
