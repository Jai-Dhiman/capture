import { useWindowDimensions } from 'react-native';

export function useResponsiveSize() {
  const { width, height } = useWindowDimensions();
  
  const postImageHeight = Math.min(210, height * 0.25);
  const threadPadding = width > 380 ? 16 : 12;
  
  return {
    postImageHeight,
    threadPadding,
    screenWidth: width,
    screenHeight: height
  };
}