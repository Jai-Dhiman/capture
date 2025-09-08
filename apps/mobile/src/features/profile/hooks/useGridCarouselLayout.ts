import { useState, useCallback, useRef } from 'react';
import { useWindowDimensions } from 'react-native';

interface GridCarouselLayout {
  // Grid measurements
  itemSize: number;
  spacing: number;
  containerPadding: number;
  numColumns: number;
  
  // Carousel positioning
  carouselTop: number;
  carouselHeight: number;
  
  // Layout refs and handlers
  gridContainerRef: React.RefObject<any>;
  onGridLayout: (event: any) => void;
  onTabBarLayout: (event: any) => void;
  updateHeaderHeight: (height: number) => void;
  
  // State
  isLayoutReady: boolean;
}

export const useGridCarouselLayout = (): GridCarouselLayout => {
  const { width, height } = useWindowDimensions();
  const gridContainerRef = useRef<any>(null);
  
  const [headerHeight, setHeaderHeight] = useState(280);
  const [tabBarLayout, setTabBarLayout] = useState({ y: 0, height: 56 });
  const [gridLayout, setGridLayout] = useState({ y: 0, height: 0 });
  const [isLayoutReady, setIsLayoutReady] = useState(false);

  // Calculate grid dimensions
  const calculateGridDimensions = useCallback(() => {
    const gridMargin = 16;
    const gridSpacing = 12; // Match ProfileTabView spacing
    const numColumns = 3;

    const availableWidth = width - gridMargin * 2;
    const itemSize = Math.floor((availableWidth - gridSpacing * (numColumns - 1)) / numColumns);

    return {
      itemSize,
      spacing: gridSpacing,
      containerPadding: gridMargin,
      numColumns,
    };
  }, [width]);

  const gridDimensions = calculateGridDimensions();

  // Calculate carousel positioning
  const calculateCarouselLayout = useCallback(() => {
    // Tab bar bottom position (where carousel should start)
    const tabBarBottom = headerHeight + tabBarLayout.y + tabBarLayout.height;
    
    // Available height for carousel (excluding safe areas and navigation)
    const bottomSafeArea = 50; // Navigation tab bar space
    const availableHeight = height - tabBarBottom - bottomSafeArea;
    
    // Calculate how many complete rows can fit
    const rowHeight = gridDimensions.itemSize + gridDimensions.spacing;
    const visibleRows = Math.floor((availableHeight - gridDimensions.spacing) / rowHeight);
    
    // Carousel height should cover exactly the visible grid area
    const carouselHeight = Math.max(
      visibleRows * rowHeight + gridDimensions.spacing, // Grid-based height
      availableHeight * 0.6 // Minimum 60% of available space
    );

    return {
      carouselTop: tabBarBottom,
      carouselHeight: Math.min(carouselHeight, availableHeight),
    };
  }, [height, headerHeight, tabBarLayout, gridDimensions]);

  const carouselLayout = calculateCarouselLayout();

  // Layout event handlers
  const onGridLayout = useCallback((event: any) => {
    const { y, height: gridHeight } = event.nativeEvent.layout;
    setGridLayout({ y, height: gridHeight });
    setIsLayoutReady(true);
  }, []);

  const onTabBarLayout = useCallback((event: any) => {
    setTabBarLayout(event.nativeEvent.layout);
  }, []);

  const updateHeaderHeight = useCallback((height: number) => {
    setHeaderHeight(height);
  }, []);

  return {
    ...gridDimensions,
    ...carouselLayout,
    gridContainerRef,
    onGridLayout,
    onTabBarLayout,
    updateHeaderHeight,
    isLayoutReady,
  };
};