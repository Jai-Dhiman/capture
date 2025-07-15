import type { AppStackParamList } from '@/navigation/types';
import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import { type RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import {
  Canvas,
  ColorMatrix,
  Group,
  Image as SkiaImage,
  useImage,
} from '@shopify/react-native-skia';
import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Image as RNImage, Text, TouchableOpacity, View } from 'react-native';
import * as MediaLibrary from 'expo-media-library';
import * as ImageManipulator from 'expo-image-manipulator';
import { useUndoRedo } from '../hooks/useUndoRedo';
import { useAutoSave } from '../hooks/useAutoSave';

type ImageEditScreenRouteProp = RouteProp<AppStackParamList, 'ImageEditScreen'>;

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

  // Convert photo library URI to a usable format for Skia
  const [localImageUri, setLocalImageUri] = useState<string | null>(null);

  useEffect(() => {
    const convertPhotoUri = async () => {
      if (imageUri.startsWith('ph://')) {
        try {
          // Extract the asset ID from the ph:// URI
          const assetId = imageUri.replace('ph://', '').split('/')[0];

          // Get asset info from MediaLibrary
          const asset = await MediaLibrary.getAssetInfoAsync(assetId);

          const sourceUri = asset.localUri || asset.uri;

          // Convert to JPEG using ImageManipulator (Skia-compatible format)
          const manipulatedImage = await ImageManipulator.manipulateAsync(
            sourceUri,
            [], // No transformations, just format conversion
            {
              compress: 0.9,
              format: ImageManipulator.SaveFormat.JPEG,
              base64: false,
            },
          );

          setLocalImageUri(manipulatedImage.uri);
        } catch (error) {
          console.error('Failed to convert photo URI:', error);
          // Try using the original URI as fallback
          setLocalImageUri(imageUri);
        }
      } else {
        setLocalImageUri(imageUri);
      }
    };

    convertPhotoUri();
  }, [imageUri]);

  const skiaImage = useImage(localImageUri);

  // Core adjustment options - memoized since it's constant
  const adjustmentOptions = useMemo(
    () => [
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
    ],
    [],
  );

  // Preset filter definitions - memoized since it's constant
  const presetFilters = useMemo(
    () => [
      {
        name: 'Original',
        icon: 'image-outline' as const,
        values: {
          Brightness: 0,
          Contrast: 1.0,
          Saturation: 1.0,
          Exposure: 0,
          Highlights: 0,
          Shadows: 0,
          Vibrance: 0,
          Warmth: 0,
          Sharpness: 0,
          Vignette: 0,
          Hue: 0,
          Lightness: 0,
        },
      },
      {
        name: 'Vintage',
        icon: 'camera-outline' as const,
        values: {
          Brightness: 0.1,
          Contrast: 0.8,
          Saturation: 0.7,
          Exposure: -0.2,
          Highlights: -0.3,
          Shadows: 0.2,
          Vibrance: -0.2,
          Warmth: 0.4,
          Sharpness: 0,
          Vignette: 0.3,
          Hue: 10,
          Lightness: -0.1,
        },
      },
      {
        name: 'Noir',
        icon: 'moon-outline' as const,
        values: {
          Brightness: -0.1,
          Contrast: 1.3,
          Saturation: 0.2,
          Exposure: -0.3,
          Highlights: -0.4,
          Shadows: 0.3,
          Vibrance: -0.5,
          Warmth: -0.2,
          Sharpness: 0.3,
          Vignette: 0.4,
          Hue: 0,
          Lightness: -0.2,
        },
      },
      {
        name: 'Vivid',
        icon: 'sunny-outline' as const,
        values: {
          Brightness: 0.2,
          Contrast: 1.2,
          Saturation: 1.4,
          Exposure: 0.1,
          Highlights: 0.1,
          Shadows: -0.1,
          Vibrance: 0.3,
          Warmth: 0.1,
          Sharpness: 0.2,
          Vignette: 0,
          Hue: 0,
          Lightness: 0.1,
        },
      },
      {
        name: 'Cool',
        icon: 'snow-outline' as const,
        values: {
          Brightness: 0.05,
          Contrast: 1.1,
          Saturation: 1.1,
          Exposure: 0,
          Highlights: 0.1,
          Shadows: -0.05,
          Vibrance: 0.1,
          Warmth: -0.3,
          Sharpness: 0.1,
          Vignette: 0,
          Hue: -10,
          Lightness: 0.05,
        },
      },
      {
        name: 'Warm',
        icon: 'flame-outline' as const,
        values: {
          Brightness: 0.1,
          Contrast: 1.05,
          Saturation: 1.2,
          Exposure: 0.1,
          Highlights: 0,
          Shadows: 0.1,
          Vibrance: 0.2,
          Warmth: 0.4,
          Sharpness: 0,
          Vignette: 0,
          Hue: 15,
          Lightness: 0.05,
        },
      },
    ],
    [],
  );

  // Adjustment icons - memoized since it's constant
  const adjustmentIcons: Record<string, React.ComponentProps<typeof Ionicons>['name']> = useMemo(
    () => ({
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
    }),
    [],
  );

  const [activeAdjustment, setActiveAdjustment] = useState(adjustmentOptions[0]);
  const [adjustmentValues, setAdjustmentValues] = useState<Record<string, number>>(() => {
    const values: Record<string, number> = {};
    for (const opt of adjustmentOptions) {
      // Set neutral/default values for each adjustment type
      switch (opt) {
        case 'Contrast':
          values[opt] = 1.0; // Neutral contrast
          break;
        case 'Saturation':
          values[opt] = 1.0; // Neutral saturation
          break;
        default:
          values[opt] = 0; // Neutral for additive adjustments
      }
    }
    return values;
  });

  // Before/after toggle state
  const [showOriginal, setShowOriginal] = useState(false);

  // UI mode state (adjustments or filters)
  const [editMode, setEditMode] = useState<'adjustments' | 'filters'>('adjustments');

  // Undo/Redo functionality
  const initialValues = useMemo(() => {
    const values: Record<string, number> = {};
    for (const opt of adjustmentOptions) {
      switch (opt) {
        case 'Contrast':
          values[opt] = 1.0;
          break;
        case 'Saturation':
          values[opt] = 1.0;
          break;
        default:
          values[opt] = 0;
      }
    }
    return values;
  }, [adjustmentOptions]);

  const { pushState, undo, redo, canUndo, canRedo } = useUndoRedo(initialValues);

  // Auto-save functionality
  const autoSaveKey = `image-edit-${imageUri.split('/').pop() || 'unknown'}`;
  const { saveNow, loadSaved, clearSaved, lastSaved, isSaving } = useAutoSave(
    {
      adjustmentValues,
      imageUri,
    },
    {
      key: autoSaveKey,
      interval: 3000, // Auto-save every 3 seconds
      enabled: true,
    },
  );

  // Debounce timer for pushing states to history
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Handle adjustment value changes
  const handleValueChange = useCallback(
    (value: number) => {
      const newValues = { ...adjustmentValues, [activeAdjustment]: value };
      setAdjustmentValues(newValues);

      // Clear existing timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      // Set new timer to push state after user stops adjusting
      debounceTimerRef.current = setTimeout(() => {
        pushState(newValues);
      }, 500); // 500ms delay
    },
    [activeAdjustment, adjustmentValues, pushState],
  );

  // Undo function
  const handleUndo = useCallback(() => {
    const previousState = undo();
    if (previousState) {
      setAdjustmentValues(previousState);
    }
  }, [undo]);

  // Redo function
  const handleRedo = useCallback(() => {
    const nextState = redo();
    if (nextState) {
      setAdjustmentValues(nextState);
    }
  }, [redo]);

  // Apply preset filter
  const applyPresetFilter = useCallback(
    (filterValues: Record<string, number>) => {
      setAdjustmentValues(filterValues);
      pushState(filterValues);
    },
    [pushState],
  );

  // Memoized render functions for FlatLists
  const renderAdjustmentItem = useCallback(
    ({ item }: { item: string }) => (
      <TouchableOpacity
        onPress={() => setActiveAdjustment(item)}
        className={`w-14 h-14 rounded-xl justify-center items-center mx-2 shadow-sm border-2 ${activeAdjustment === item ? 'bg-[#e4cac7] border-black' : 'bg-transparent border-black'}`}
      >
        <Ionicons name={adjustmentIcons[item]} size={24} color="black" />
      </TouchableOpacity>
    ),
    [activeAdjustment, adjustmentIcons],
  );

  const renderFilterItem = useCallback(
    ({ item }: { item: (typeof presetFilters)[0] }) => (
      <TouchableOpacity
        onPress={() => applyPresetFilter(item.values)}
        className="items-center mx-3"
      >
        <View className="w-16 h-16 rounded-xl justify-center items-center bg-[#E4CAC7] border-2 border-black shadow-sm">
          <Ionicons name={item.icon} size={24} color="black" />
        </View>
        <Text className="text-xs text-black mt-2 text-center font-medium">{item.name}</Text>
      </TouchableOpacity>
    ),
    [applyPresetFilter],
  );

  // Memoized key extractors
  const adjustmentKeyExtractor = useCallback((item: string) => item, []);
  const filterKeyExtractor = useCallback((item: (typeof presetFilters)[0]) => item.name, []);

  // Memoized FlatList props
  const adjustmentContentContainerStyle = useMemo(() => ({ paddingHorizontal: 16 }), []);
  const filterContentContainerStyle = useMemo(() => ({ paddingHorizontal: 16 }), []);

  // Memoized toggle functions
  const toggleOriginal = useCallback(() => {
    setShowOriginal(!showOriginal);
  }, [showOriginal]);

  const setAdjustmentMode = useCallback(() => {
    setEditMode('adjustments');
  }, []);

  const setFilterMode = useCallback(() => {
    setEditMode('filters');
  }, []);

  const handleManualSave = useCallback(async () => {
    try {
      await saveNow(); // Force save current state
      await clearSaved(); // Clear auto-save since user explicitly saved
      // TODO: Add additional save logic (export image, etc.)
    } catch (error) {
      console.error('Manual save failed:', error);
    }
  }, [saveNow, clearSaved]);

  const handleCancel = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  // Memoized current adjustment value for display
  const currentAdjustmentValue = useMemo(() => {
    return adjustmentValues[activeAdjustment]?.toFixed(2) || '0.00';
  }, [adjustmentValues, activeAdjustment]);

  // Get the range for each adjustment type - memoized for performance
  const getAdjustmentRange = useCallback((adjustment: string): { min: number; max: number } => {
    switch (adjustment) {
      case 'Brightness':
        return { min: -1.0, max: 1.0 };
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
  }, []);

  // Memoized current adjustment range
  const currentAdjustmentRange = useMemo(() => {
    return getAdjustmentRange(activeAdjustment);
  }, [activeAdjustment, getAdjustmentRange]);

  // Load saved edits on mount
  useEffect(() => {
    const loadSavedEdits = async () => {
      try {
        const saved = await loadSaved();
        if (saved && saved.imageUri === imageUri) {
          // Only load if it's for the same image
          setAdjustmentValues(saved.adjustmentValues);
        }
      } catch (error) {
        console.error('Failed to load saved edits:', error);
      }
    };

    loadSavedEdits();
  }, [imageUri, loadSaved]);

  // Clear auto-save when leaving screen
  useEffect(() => {
    return () => {
      // Clear saved data when user navigates away (optional)
      // clearSaved();
    };
  }, []);

  // Cleanup debounce timer
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

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
    // Multiply 4x5 matrices (stored as flat arrays)
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 5; j++) {
        for (let k = 0; k < 4; k++) {
          result[i * 5 + j] += a[i * 5 + k] * b[k * 5 + j];
        }
        // Handle the translation column (last column)
        if (j === 4) {
          result[i * 5 + j] += a[i * 5 + 4];
        }
      }
    }
    return result;
  }, []);

  // Combine all active adjustments into a single matrix
  const combinedMatrix = useMemo(() => {
    // Return identity matrix if showing original
    if (showOriginal) {
      return [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0];
    }

    // Start with identity matrix
    let matrix = [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0];

    // Apply each adjustment that has a non-default value
    for (const [adjustment, value] of Object.entries(adjustmentValues)) {
      const isDefaultValue =
        (adjustment === 'Contrast' && Math.abs(value - 1.0) < 0.001) ||
        (adjustment === 'Saturation' && Math.abs(value - 1.0) < 0.001) ||
        (adjustment !== 'Contrast' && adjustment !== 'Saturation' && Math.abs(value) < 0.001);

      if (!isDefaultValue) {
        const adjustMatrix = getAdjustmentMatrix(adjustment, value);
        matrix = multiplyMatrices(matrix, adjustMatrix);
      }
    }

    return matrix;
  }, [adjustmentValues, getAdjustmentMatrix, multiplyMatrices, showOriginal]);

  return (
    <View className="flex-1 bg-zinc-300 rounded-[30px] overflow-hidden p-4 pt-20">
      {/* Preview */}
      <View className="items-center">
        <View className="w-[340px] h-[510px] rounded-[10px] border border-black overflow-hidden relative">
          {skiaImage ? (
            <Canvas style={{ width: '100%', height: '100%' }}>
              <Group>
                <ColorMatrix matrix={combinedMatrix} />
                <SkiaImage image={skiaImage} x={0} y={0} width={340} height={510} fit="cover" />
              </Group>
            </Canvas>
          ) : (
            <RNImage
              source={{ uri: imageUri }}
              style={{ width: '100%', height: '100%' }}
              resizeMode="cover"
            />
          )}

          {/* Before/After Toggle Button */}
          <TouchableOpacity
            onPress={toggleOriginal}
            className="absolute top-4 right-4 bg-black/50 rounded-full px-3 py-1.5"
          >
            <Text className="text-white text-xs font-medium">
              {showOriginal ? 'After' : 'Before'}
            </Text>
          </TouchableOpacity>

          {/* Auto-Save Indicator */}
          <View className="absolute top-4 left-4 bg-black/50 rounded-full px-2 py-1 flex-row items-center">
            <View
              className={`w-2 h-2 rounded-full mr-1.5 ${isSaving ? 'bg-yellow-400' : 'bg-green-400'
                }`}
            />
            <Text className="text-white text-xs">
              {isSaving ? 'Saving...' : lastSaved ? 'Saved' : 'Auto-save'}
            </Text>
          </View>
        </View>
      </View>

      {/* Mode Toggle */}
      <View className="flex-row justify-center mt-6 mb-4">
        <View className="flex-row bg-gray-200 rounded-full p-1">
          <TouchableOpacity
            onPress={setAdjustmentMode}
            className={`px-6 py-2 rounded-full ${editMode === 'adjustments' ? 'bg-[#E4CAC7] border border-black' : 'bg-transparent'
              }`}
          >
            <Text
              className={`text-sm ${editMode === 'adjustments' ? 'text-black font-semibold' : 'text-gray-600'}`}
            >
              Adjustments
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={setFilterMode}
            className={`px-6 py-2 rounded-full ${editMode === 'filters' ? 'bg-[#E4CAC7] border border-black' : 'bg-transparent'
              }`}
          >
            <Text
              className={`text-sm ${editMode === 'filters' ? 'text-black font-semibold' : 'text-gray-600'}`}
            >
              Filters
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {editMode === 'adjustments' ? (
        <>
          {/* Adjustment icons */}
          <View className="h-20">
            <FlatList
              data={adjustmentOptions}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={adjustmentContentContainerStyle}
              keyExtractor={adjustmentKeyExtractor}
              renderItem={renderAdjustmentItem}
            />
          </View>
          {/* Slider */}
          <View className="mt-4 items-center px-4">
            <Text className="text-center text-black text-base font-semibold">
              {activeAdjustment}
            </Text>
            <Text className="text-center text-black text-sm mb-2">{currentAdjustmentValue}</Text>
            <View className="w-full px-4">
              <Slider
                style={{ width: '100%', height: 40 }}
                minimumValue={currentAdjustmentRange.min}
                maximumValue={currentAdjustmentRange.max}
                value={adjustmentValues[activeAdjustment]}
                onValueChange={handleValueChange}
                minimumTrackTintColor="#E4CAC7"
                maximumTrackTintColor="#D8C0BD"
              // thumbStyle={{ backgroundColor: '#E4CAC7', borderWidth: 2, borderColor: '#D8C0BD' }}
              />
            </View>
          </View>
        </>
      ) : (
        /* Preset Filters */
        <View className="h-32">
          <FlatList
            data={presetFilters}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={filterContentContainerStyle}
            keyExtractor={filterKeyExtractor}
            renderItem={renderFilterItem}
          />
        </View>
      )}
      {/* Undo/Redo Controls */}
      <View className="flex-row justify-center items-center gap-4 px-4 py-2">
        <TouchableOpacity
          onPress={handleUndo}
          disabled={!canUndo}
          className={`w-12 h-12 rounded-full justify-center items-center border-2 ${canUndo ? 'bg-[#E4CAC7] border-black' : 'bg-gray-300 border-gray-400'
            }`}
        >
          <Ionicons name="arrow-undo" size={20} color={canUndo ? 'black' : 'gray'} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={handleRedo}
          disabled={!canRedo}
          className={`w-12 h-12 rounded-full justify-center items-center border-2 ${canRedo ? 'bg-[#E4CAC7] border-black' : 'bg-gray-300 border-gray-400'
            }`}
        >
          <Ionicons name="arrow-redo" size={20} color={canRedo ? 'black' : 'gray'} />
        </TouchableOpacity>
      </View>

      {/* Actions */}
      <View className="flex-row justify-between px-8 py-4">
        <TouchableOpacity
          onPress={handleCancel}
          className="bg-[#E4CAC7] rounded-[30px] border border-[#D8C0BD] px-8 py-2"
        >
          <Text className="text-black text-xs">Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={handleManualSave}
          className="bg-[#E4CAC7] rounded-[30px] border border-[#D8C0BD] px-8 py-2"
        >
          <Text className="text-black text-xs">Save</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
