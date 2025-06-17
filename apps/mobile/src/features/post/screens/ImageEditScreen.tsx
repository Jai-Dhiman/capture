import type { RootStackParamList } from '@/navigation/types';
import { Ionicons } from '@expo/vector-icons';
import { type RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { Canvas, ColorMatrix, Image as SkiaImage, useImage } from '@shopify/react-native-skia';
import type React from 'react';
import { useState } from 'react';
import { FlatList, Image as RNImage, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type ImageEditScreenRouteProp = RouteProp<RootStackParamList, 'ImageEditScreen'>;

export default function ImageEditScreen() {
  const navigation = useNavigation();
  const route = useRoute<ImageEditScreenRouteProp>();
  const imageUri = route.params?.imageUri || '';

  if (!imageUri) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: '#DCDCDE',
        }}
      >
        <Text style={{ fontSize: 16, color: '#333', textAlign: 'center', padding: 20 }}>
          No image provided. Please select an image first.
        </Text>
        <TouchableOpacity
          style={{
            marginTop: 20,
            padding: 12,
            backgroundColor: '#E4CAC7',
            borderRadius: 30,
            borderWidth: 1,
            borderColor: '#D8C0BD',
          }}
          onPress={() => navigation.goBack()}
        >
          <Text style={{ color: 'black' }}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const skiaImage = useImage(imageUri);
  const filterOptions = [
    'Exposure',
    'Brilliance',
    'Highlights',
    'Shadows',
    'Contrast',
    'Brightness',
    'Saturation',
    'Vibrance',
    'Warmth',
    'Tint',
    'Sharpness',
    'Definition',
    'Vignette',
  ];
  const filterIcons: Record<string, React.ComponentProps<typeof Ionicons>['name']> = {
    Exposure: 'sunny-outline',
    Brilliance: 'sparkles-outline',
    Highlights: 'sunny-outline',
    Shadows: 'moon-outline',
    Contrast: 'contrast-outline',
    Brightness: 'sunny',
    Saturation: 'color-palette-outline',
    Vibrance: 'color-wand-outline',
    Warmth: 'thermometer-outline',
    Tint: 'color-fill-outline',
    Sharpness: 'speedometer-outline',
    Definition: 'document-text-outline',
    Vignette: 'ellipse-outline',
  };
  const [activeFilter, setActiveFilter] = useState(filterOptions[0]);
  const [filterValues, setFilterValues] = useState<Record<string, number>>(() =>
    filterOptions.reduce((acc, opt) => ({ ...acc, [opt]: 0 }), {} as Record<string, number>),
  );
  const handleValueChange = (value: number) =>
    setFilterValues((prev) => ({ ...prev, [activeFilter]: value }));
  const getFilterMatrix = (filter: string, value: number) => {
    switch (filter) {
      case 'Brightness':
        return [1, 0, 0, 0, value, 0, 1, 0, 0, value, 0, 0, 1, 0, value, 0, 0, 0, 1, 0];
      case 'Contrast':
        const t = (1 - value) * 0.5;
        return [value, 0, 0, 0, t, 0, value, 0, 0, t, 0, 0, value, 0, t, 0, 0, 0, 1, 0];
      case 'Saturation':
        const s = value;
        const inv = 1 - s;
        const R = 0.2126 * inv;
        const G = 0.7152 * inv;
        const B = 0.0722 * inv;
        return [R + s, G, B, 0, 0, R, G + s, B, 0, 0, R, G, B + s, 0, 0, 0, 0, 0, 1, 0];
      default:
        return [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0];
    }
  };

  return (
    <View className="flex-1 bg-zinc-300 rounded-[30px] overflow-hidden p-4 pt-20">
      {/* Preview */}
      <View className="items-center">
        <View className="w-[340px] h-[510px] rounded-[10px] border border-black overflow-hidden relative">
          <RNImage
            source={{ uri: imageUri }}
            style={{ width: '100%', height: '100%' }}
            resizeMode="cover"
          />
          {skiaImage && (
            <Canvas style={StyleSheet.absoluteFillObject}>
              <SkiaImage image={skiaImage} x={0} y={0} width={340} height={510} fit="cover" />
              <ColorMatrix matrix={getFilterMatrix(activeFilter, filterValues[activeFilter])} />
            </Canvas>
          )}
        </View>
      </View>
      {/* Filter icons */}
      <View className="mt-8 h-20">
        <FlatList
          data={filterOptions}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16 }}
          keyExtractor={(item) => item}
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => setActiveFilter(item)}
              className={`w-14 h-14 rounded-xl justify-center items-center mx-2 shadow-sm border-2 ${activeFilter === item ? 'bg-[#e4cac7] border-black' : 'bg-transparent border-black'}`}
            >
              <Ionicons name={filterIcons[item]} size={24} color="black" />
            </TouchableOpacity>
          )}
        />
      </View>
      {/* Slider */}
      <View className="mt-4 items-center px-4">
        <Text className="text-center text-black text-base font-semibold">{activeFilter}</Text>
        <Text className="text-center text-black text-sm mb-2">
          {filterValues[activeFilter].toFixed(1)}
        </Text>
        {/* Placholder for Slider */}
      </View>
      {/* Actions */}
      <View className="flex-row justify-between px-8 py-4 mt-auto">
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          className="bg-[#E4CAC7] rounded-[30px] border border-[#D8C0BD] px-8 py-2"
        >
          <Text className="text-black text-xs">Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => {
            /* TODO: save logic */
          }}
          className="bg-[#E4CAC7] rounded-[30px] border border-[#D8C0BD] px-8 py-2"
        >
          <Text className="text-black text-xs">Save</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
