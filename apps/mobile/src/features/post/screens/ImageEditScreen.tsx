import type { RootStackParamList } from '@/navigation/types';
import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import { type RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { Canvas, ColorMatrix, Image as SkiaImage, useImage } from '@shopify/react-native-skia';
import type React from 'react';
import { useCallback, useMemo, useState } from 'react';
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

  // Core adjustment options
  const adjustmentOptions = [
    'Brightness',
    'Contrast',
    'Saturation',
    'Exposure',
    'Highlights',
    'Shadows',
    'Vibrance',
    'Warmth',
    'Sharpness',
    'Vignette',
    'Hue',
    'Lightness',
  ];

  const adjustmentIcons: Record<string, React.ComponentProps<typeof Ionicons>['name']> = {
    Brightness: 'sunny',
    Contrast: 'contrast-outline',
    Saturation: 'color-palette-outline',
    Exposure: 'sunny-outline',
    Highlights: 'flashlight-outline',
    Shadows: 'moon-outline',
    Vibrance: 'color-wand-outline',
    Warmth: 'thermometer-outline',
    Sharpness: 'diamond-outline',
    Vignette: 'aperture-outline',
    Hue: 'color-filter-outline',
    Lightness: 'bulb-outline',
  };

  const [activeAdjustment, setActiveAdjustment] = useState(adjustmentOptions[0]);
  const [adjustmentValues, setAdjustmentValues] = useState<Record<string, number>>(() => {
    const values: Record<string, number> = {};
    for (const opt of adjustmentOptions) {
      values[opt] = 0;
    }
    return values;
  });

  // Handle adjustment value changes
  const handleValueChange = useCallback(
    (value: number) => {
      setAdjustmentValues((prev) => ({ ...prev, [activeAdjustment]: value }));
    },
    [activeAdjustment],
  );

  // Get the range for each adjustment type
  const getAdjustmentRange = (adjustment: string): { min: number; max: number } => {
    switch (adjustment) {
      case 'Brightness':
        return { min: -0.5, max: 0.5 };
      case 'Contrast':
        return { min: 0.5, max: 2.0 };
      case 'Saturation':
        return { min: 0, max: 2.0 };
      case 'Exposure':
        return { min: -2.0, max: 2.0 };
      case 'Highlights':
        return { min: -1.0, max: 1.0 };
      case 'Shadows':
        return { min: -1.0, max: 1.0 };
      case 'Vibrance':
        return { min: -1.0, max: 1.0 };
      case 'Warmth':
        return { min: -1.0, max: 1.0 };
      case 'Sharpness':
        return { min: 0, max: 2.0 };
      case 'Vignette':
        return { min: 0, max: 1.0 };
      case 'Hue':
        return { min: -180, max: 180 };
      case 'Lightness':
        return { min: -1.0, max: 1.0 };
      default:
        return { min: -1.0, max: 1.0 };
    }
  };

  // Enhanced color matrix generation with proper shader calculations
  const getAdjustmentMatrix = useCallback((adjustment: string, value: number): number[] => {
    switch (adjustment) {
      case 'Brightness':
        // Add brightness value to RGB channels
        return [1, 0, 0, 0, value, 0, 1, 0, 0, value, 0, 0, 1, 0, value, 0, 0, 0, 1, 0];

      case 'Contrast': {
        // Scale RGB values and offset to maintain mid-tone
        const t = (1 - value) * 0.5;
        return [value, 0, 0, 0, t, 0, value, 0, 0, t, 0, 0, value, 0, t, 0, 0, 0, 1, 0];
      }

      case 'Saturation': {
        // Convert to grayscale using luminance weights, then interpolate
        const s = value;
        const inv = 1 - s;
        const R = 0.2126 * inv;
        const G = 0.7152 * inv;
        const B = 0.0722 * inv;
        return [R + s, G, B, 0, 0, R, G + s, B, 0, 0, R, G, B + s, 0, 0, 0, 0, 0, 1, 0];
      }

      case 'Exposure': {
        // Exponential scaling for exposure
        const exp = 2 ** value;
        return [exp, 0, 0, 0, 0, 0, exp, 0, 0, 0, 0, 0, exp, 0, 0, 0, 0, 0, 1, 0];
      }

      case 'Highlights': {
        // Compress highlights by reducing gain in bright areas
        const highlight = 1 - value * 0.3;
        return [
          highlight,
          0,
          0,
          0,
          value * 0.1,
          0,
          highlight,
          0,
          0,
          value * 0.1,
          0,
          0,
          highlight,
          0,
          value * 0.1,
          0,
          0,
          0,
          1,
          0,
        ];
      }

      case 'Shadows':
        // Lift shadows by adding to dark areas
        return [
          1,
          0,
          0,
          0,
          value * 0.2,
          0,
          1,
          0,
          0,
          value * 0.2,
          0,
          0,
          1,
          0,
          value * 0.2,
          0,
          0,
          0,
          1,
          0,
        ];

      case 'Vibrance': {
        // Enhanced saturation for less saturated colors
        const vib = 1 + value * 0.5;
        const vibInv = 1 - vib;
        const vibR = 0.2126 * vibInv;
        const vibG = 0.7152 * vibInv;
        const vibB = 0.0722 * vibInv;
        return [
          vibR + vib,
          vibG,
          vibB,
          0,
          0,
          vibR,
          vibG + vib,
          vibB,
          0,
          0,
          vibR,
          vibG,
          vibB + vib,
          0,
          0,
          0,
          0,
          0,
          1,
          0,
        ];
      }

      case 'Warmth': {
        // Shift color temperature (blue <-> orange)
        const warm = value * 0.3;
        return [1 + warm, 0, 0, 0, 0, 0, 1, 0, 0, warm * 0.5, 0, 0, 1 - warm, 0, 0, 0, 0, 0, 1, 0];
      }

      case 'Sharpness': {
        // Sharpness enhancement using convolution-like effect
        // Increase contrast between adjacent pixels
        const sharp = 1 + value * 0.5;
        const offset = -value * 0.1;
        return [
          sharp,
          0,
          0,
          0,
          offset,
          0,
          sharp,
          0,
          0,
          offset,
          0,
          0,
          sharp,
          0,
          offset,
          0,
          0,
          0,
          1,
          0,
        ];
      }

      case 'Vignette': {
        // Vignette effect by darkening edges
        // This is a simplified approach - proper vignette requires position-based calculations
        const vign = 1 - value * 0.3;
        return [vign, 0, 0, 0, 0, 0, vign, 0, 0, 0, 0, 0, vign, 0, 0, 0, 0, 0, 1, 0];
      }

      case 'Hue': {
        // Hue shift using color rotation
        const hueRadians = (value * Math.PI) / 180;
        const cos = Math.cos(hueRadians);
        const sin = Math.sin(hueRadians);
        const lumR = 0.299;
        const lumG = 0.587;
        const lumB = 0.114;

        return [
          lumR + cos * (1 - lumR) + sin * -lumR,
          lumG + cos * -lumG + sin * -lumG,
          lumB + cos * -lumB + sin * (1 - lumB),
          0,
          0,
          lumR + cos * -lumR + sin * 0.143,
          lumG + cos * (1 - lumG) + sin * 0.14,
          lumB + cos * -lumB + sin * -0.283,
          0,
          0,
          lumR + cos * -lumR + sin * -(1 - lumR),
          lumG + cos * -lumG + sin * lumG,
          lumB + cos * (1 - lumB) + sin * lumB,
          0,
          0,
          0,
          0,
          0,
          1,
          0,
        ];
      }

      case 'Lightness': {
        // Lightness adjustment (similar to brightness but more perceptually uniform)
        const light = value * 0.5;
        return [1, 0, 0, 0, light, 0, 1, 0, 0, light, 0, 0, 1, 0, light, 0, 0, 0, 1, 0];
      }

      default:
        return [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0];
    }
  }, []);

  // Matrix multiplication helper function
  const multiplyMatrices = useCallback((a: number[], b: number[]): number[] => {
    const result = new Array(20).fill(0);
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 5; j++) {
        for (let k = 0; k < 4; k++) {
          result[i * 5 + j] += a[i * 5 + k] * b[k * 5 + j];
        }
        if (j === 4) {
          result[i * 5 + j] += a[i * 5 + 4];
        }
      }
    }
    return result;
  }, []);

  // Combine all active adjustments into a single matrix
  const combinedMatrix = useMemo(() => {
    // Start with identity matrix
    let matrix = [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0];

    // Apply each non-zero adjustment by multiplying matrices
    for (const [adjustment, value] of Object.entries(adjustmentValues)) {
      if (Math.abs(value) > 0.001) {
        const adjustMatrix = getAdjustmentMatrix(adjustment, value);
        matrix = multiplyMatrices(matrix, adjustMatrix);
      }
    }

    return matrix;
  }, [adjustmentValues, getAdjustmentMatrix, multiplyMatrices]);

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
              <SkiaImage image={skiaImage} x={0} y={0} width={340} height={510} fit="cover">
                <ColorMatrix matrix={combinedMatrix} />
              </SkiaImage>
            </Canvas>
          )}
        </View>
      </View>
      {/* Adjustment icons */}
      <View className="mt-8 h-20">
        <FlatList
          data={adjustmentOptions}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16 }}
          keyExtractor={(item) => item}
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => setActiveAdjustment(item)}
              className={`w-14 h-14 rounded-xl justify-center items-center mx-2 shadow-sm border-2 ${activeAdjustment === item ? 'bg-[#e4cac7] border-black' : 'bg-transparent border-black'}`}
            >
              <Ionicons name={adjustmentIcons[item]} size={24} color="black" />
            </TouchableOpacity>
          )}
        />
      </View>
      {/* Slider */}
      <View className="mt-4 items-center px-4">
        <Text className="text-center text-black text-base font-semibold">{activeAdjustment}</Text>
        <Text className="text-center text-black text-sm mb-2">
          {adjustmentValues[activeAdjustment].toFixed(2)}
        </Text>
        <View className="w-full px-4">
          <Slider
            style={{ width: '100%', height: 40 }}
            minimumValue={getAdjustmentRange(activeAdjustment).min}
            maximumValue={getAdjustmentRange(activeAdjustment).max}
            value={adjustmentValues[activeAdjustment]}
            onValueChange={handleValueChange}
            minimumTrackTintColor="#E4CAC7"
            maximumTrackTintColor="#D8C0BD"
            // thumbStyle={{ backgroundColor: '#E4CAC7', borderWidth: 2, borderColor: '#D8C0BD' }}
          />
        </View>
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
