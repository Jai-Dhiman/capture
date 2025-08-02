import React from 'react';
import { Platform, View } from 'react-native';
import type { ImageStyle, StyleProp } from 'react-native';

interface SvgIconProps {
  svg: string;
  width?: number;
  height?: number;
  style?: StyleProp<ImageStyle>;
}

export function SvgIcon({ svg, width = 24, height = 24, style }: SvgIconProps) {
  if (Platform.OS === 'web') {
    // For web, render SVG directly in dangerouslySetInnerHTML
    const cleanSvg = svg.replace(/width="[^"]*"/, `width="${width}"`).replace(/height="[^"]*"/, `height="${height}"`);
    
    return (
      <div
        style={{
          width,
          height,
          display: 'inline-block',
          ...style
        }}
        dangerouslySetInnerHTML={{ __html: cleanSvg }}
      />
    );
  }

  // For native platforms, use Image with data URI
  const { Image } = require('react-native');
  const svgUri = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;

  return (
    <Image
      source={{ uri: svgUri }}
      style={[{ width, height }, style]}
      resizeMode="contain"
    />
  );
}