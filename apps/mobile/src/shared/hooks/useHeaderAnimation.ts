import { useRef, useState, useCallback, useEffect } from 'react';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';

interface UseHeaderAnimationOptions {
  hideThreshold?: number;
  showThreshold?: number;
  resetOnStateChange?: boolean;
  fastScrollVelocity?: number;
}

interface UseHeaderAnimationReturn {
  hideHeader: boolean;
  handleScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  resetHeader: () => void;
  forceHideHeader: (hide: boolean) => void;
}

export const useHeaderAnimation = (
  options: UseHeaderAnimationOptions = {}
): UseHeaderAnimationReturn => {
  const {
    hideThreshold = 40,
    showThreshold = 0,
    resetOnStateChange = true,
    fastScrollVelocity = 15, // Minimum upward velocity to show header
  } = options;

  const [hideHeader, setHideHeader] = useState(false);
  const prevScrollY = useRef(0);
  const scrollDirection = useRef<'up' | 'down' | null>(null);
  const animationFrame = useRef<number | null>(null);
  const lastScrollTime = useRef(Date.now());

  const handleScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    // Extract values immediately before React pools the event
    const currentY = event.nativeEvent.contentOffset.y;
    const currentTime = Date.now();
    const deltaY = currentY - prevScrollY.current;
    const deltaTime = currentTime - lastScrollTime.current;
    
    // Cancel previous animation frame to debounce
    if (animationFrame.current) {
      cancelAnimationFrame(animationFrame.current);
    }

    animationFrame.current = requestAnimationFrame(() => {
      // Calculate scroll velocity (pixels per millisecond)
      const velocity = deltaTime > 0 ? Math.abs(deltaY) / deltaTime : 0;
      
      // Determine scroll direction
      const currentDirection = deltaY > 0 ? 'down' : 'up';
      
      // Only update if direction changed or we're past threshold
      if (currentDirection !== scrollDirection.current || Math.abs(deltaY) > 5) {
        scrollDirection.current = currentDirection;
        
        // Hide header when scrolling down past threshold
        if (currentY > hideThreshold && deltaY > 0) {
          setHideHeader(true);
        }
        // Show header only when:
        // 1. Near the top (always show), OR
        // 2. Scrolling up fast enough (velocity-based)
        else if (currentY <= showThreshold || (deltaY < 0 && velocity >= fastScrollVelocity)) {
          setHideHeader(false);
        }
        // For slow upward scrolling, keep header hidden if it's already hidden
      }
      
      prevScrollY.current = currentY;
      lastScrollTime.current = currentTime;
    });
  }, [hideThreshold, showThreshold, fastScrollVelocity]);

  const resetHeader = useCallback(() => {
    setHideHeader(false);
    prevScrollY.current = 0;
    scrollDirection.current = null;
    lastScrollTime.current = Date.now();
    if (animationFrame.current) {
      cancelAnimationFrame(animationFrame.current);
      animationFrame.current = null;
    }
  }, []);

  const forceHideHeader = useCallback((hide: boolean) => {
    setHideHeader(hide);
  }, []);

  // Cleanup animation frame on unmount
  useEffect(() => {
    return () => {
      if (animationFrame.current) {
        cancelAnimationFrame(animationFrame.current);
      }
    };
  }, []);

  return {
    hideHeader,
    handleScroll,
    resetHeader,
    forceHideHeader,
  };
};