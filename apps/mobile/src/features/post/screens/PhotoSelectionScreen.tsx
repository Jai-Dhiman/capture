/*
Is this screen being used??
*/


import type React from 'react';
import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  Pressable,
  useWindowDimensions,
  StatusBar,
} from 'react-native';
import { Image } from 'expo-image';
import * as MediaLibrary from 'expo-media-library';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/types';
import { useAlert } from '@/shared/lib/AlertContext';
import Header from '@/shared/components/Header';
import DraggableFlatList from 'react-native-draggable-flatlist';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface PhotoAsset {
  id: string;
  uri: string;
  width: number;
  height: number;
  filename: string;
  creationTime: number;
  mediaType: 'photo' | 'video';
}

interface SelectedPhoto {
  uri: string;
  type: string;
  name: string;
  order: number;
}

interface Album {
  id: string;
  title: string;
  assetCount: number;
  type: string;
}

interface PhotoSelectionScreenProps {
  route: {
    params: {
      maxSelection?: number;
      onPhotosSelected: (photos: SelectedPhoto[]) => void;
    };
  };
}

const PhotoSelectionScreen: React.FC<PhotoSelectionScreenProps> = ({ route }) => {
  const navigation = useNavigation<NavigationProp>();
  const { maxSelection = 4, onPhotosSelected } = route.params;
  const { width } = useWindowDimensions();
  const { showAlert } = useAlert();

  // State
  const [photos, setPhotos] = useState<PhotoAsset[]>([]);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [selectedPhotos, setSelectedPhotos] = useState<SelectedPhoto[]>([]);
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<Set<string>>(new Set());
  const [currentAlbum, setCurrentAlbum] = useState<Album | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [showAlbums, setShowAlbums] = useState(false);

  // Refs
  const flatListRef = useRef<FlatList>(null);

  // Constants
  const GRID_COLUMNS = 3;
  const PHOTO_SIZE = width / GRID_COLUMNS; // True edge to edge photos
  const { height } = useWindowDimensions();
  const SELECTED_SECTION_HEIGHT = height * 0.5; // 50% of screen height - taller
  const SELECTED_PHOTO_SIZE = (width - 40) / 2; // Larger size for selected photos

  // Request permissions and load photos
  useEffect(() => {
    requestPermissionsAndLoadPhotos();
  }, []);

  const requestPermissionsAndLoadPhotos = async () => {
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      setHasPermission(status === 'granted');

      if (status === 'granted') {
        await loadAlbums();
      } else {
        showAlert('Please allow access to your photos to select images', { type: 'warning' });
      }
    } catch (error) {
      console.error('Permission error:', error);
      showAlert('Failed to access photo library', { type: 'error' });
    }
  };

  const loadAlbums = async () => {
    try {
      const albumsResult = await MediaLibrary.getAlbumsAsync({
        includeSmartAlbums: true,
      });

      const albumsWithCount = await Promise.all(
        albumsResult.map(async (album) => {
          const assetCount = await MediaLibrary.getAssetsAsync({
            album: album.id,
            mediaType: 'photo',
            first: 0,
          });
          return {
            id: album.id,
            title: album.title,
            assetCount: assetCount.totalCount,
            type: album.type,
          };
        }),
      );

      setAlbums(albumsWithCount.filter((album) => album.assetCount > 0) as Album[]);

      // Find and load "Recents" album specifically
      if (albumsWithCount.length > 0) {
        // Try multiple approaches to find the Recents album
        let recentsAlbum = albumsWithCount.find((album) =>
          album.title.toLowerCase() === 'recents' ||
          album.title.toLowerCase() === 'recent' ||
          album.title.toLowerCase() === 'camera roll' ||
          album.title.toLowerCase() === 'all photos'
        );

        // If not found by title, try to find by type (smart albums are usually recents)
        if (!recentsAlbum) {
          recentsAlbum = albumsWithCount.find((album) => album.type === 'smartAlbum');
        }

        // Final fallback to first album
        if (!recentsAlbum) {
          recentsAlbum = albumsWithCount[0];
        }

        setCurrentAlbum(recentsAlbum as Album);
        await loadPhotosFromAlbum(recentsAlbum.id);
      }
    } catch (error) {
      console.error('Failed to load albums:', error);
      showAlert('Failed to load photo albums', { type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const loadPhotosFromAlbum = async (albumId: string, after?: string) => {
    try {
      const result = await MediaLibrary.getAssetsAsync({
        album: albumId,
        mediaType: 'photo',
        first: 50,
        after,
        sortBy: ['creationTime'],
      });

      const photoAssets: PhotoAsset[] = result.assets.map((asset) => ({
        id: asset.id,
        uri: asset.uri,
        width: asset.width,
        height: asset.height,
        filename: asset.filename,
        creationTime: asset.creationTime,
        mediaType: asset.mediaType === 'photo' ? 'photo' : 'video',
      }));

      if (after) {
        setPhotos((prevPhotos) => [...prevPhotos, ...photoAssets]);
      } else {
        setPhotos(photoAssets);
      }
    } catch (error) {
      console.error('Failed to load photos:', error);
      showAlert('Failed to load photos', { type: 'error' });
    }
  };

  const handlePhotoPress = (photo: PhotoAsset) => {
    const isSelected = selectedPhotoIds.has(photo.id);

    if (isSelected) {
      // Remove from selection
      setSelectedPhotoIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(photo.id);
        return newSet;
      });
      setSelectedPhotos((prev) => prev.filter((p) => p.uri !== photo.uri));
    } else {
      // Add to selection
      if (selectedPhotos.length >= maxSelection) {
        showAlert(`Maximum of ${maxSelection} photos allowed`, { type: 'warning' });
        return;
      }

      setSelectedPhotoIds((prev) => new Set([...prev, photo.id]));
      setSelectedPhotos((prev) => [
        ...prev,
        {
          uri: photo.uri,
          type: 'image/jpeg',
          name: `photo-${Date.now()}.jpg`,
          order: prev.length,
        },
      ]);
    }
  };

  const handleAlbumSelect = async (album: Album) => {
    setCurrentAlbum(album);
    setShowAlbums(false);
    setLoading(true);
    await loadPhotosFromAlbum(album.id);
    setLoading(false);
  };

  const handleDone = () => {
    if (selectedPhotos.length === 0) {
      showAlert('Please select at least one photo', { type: 'warning' });
      return;
    }

    onPhotosSelected(selectedPhotos);
    navigation.goBack();
  };

  const handleRemoveFromSelection = (index: number) => {
    const photoToRemove = selectedPhotos[index];
    setSelectedPhotos((prev) => prev.filter((_, i) => i !== index));
    setSelectedPhotoIds((prev) => {
      const newSet = new Set(prev);
      // Find the photo ID by URI
      const photoId = photos.find((p) => p.uri === photoToRemove.uri)?.id;
      if (photoId) {
        newSet.delete(photoId);
      }
      return newSet;
    });
  };

  const renderPhotoItem = ({ item, index }: { item: PhotoAsset; index: number }) => {
    const isSelected = selectedPhotoIds.has(item.id);
    const selectionIndex = selectedPhotos.findIndex((p) => p.uri === item.uri);

    return (
      <TouchableOpacity
        onPress={() => handlePhotoPress(item)}
        style={{
          width: PHOTO_SIZE,
          height: PHOTO_SIZE,
        }}
      >
        <Image
          source={{ uri: item.uri }}
          style={{
            width: '100%',
            height: '100%',
            borderRadius: 4,
          }}
          contentFit="cover"
          cachePolicy="memory-disk"
          transition={150}
          placeholder={{ blurhash: 'L6PZfSi_.AyE_3t7t7R**0o#DgR4' }}
        />

        {/* Selection indicator */}
        <View
          style={{
            position: 'absolute',
            top: 4,
            right: 4,
            width: 24,
            height: 24,
            borderRadius: 12,
            backgroundColor: isSelected ? '#007AFF' : 'rgba(0,0,0,0.3)',
            borderWidth: 2,
            borderColor: 'white',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          {isSelected && (
            <Text style={{ color: 'white', fontSize: 12, fontWeight: 'bold' }}>
              {selectionIndex + 1}
            </Text>
          )}
        </View>

        {/* Dark overlay for selected photos */}
        {isSelected && (
          <View
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0,0,0,0.2)',
              borderRadius: 4,
            }}
          />
        )}
      </TouchableOpacity>
    );
  };

  const renderSelectedPhoto = ({ item, index, drag }: any) => {
    const photoHeight = (SELECTED_SECTION_HEIGHT - 60) / 2; // Make photos taller to fill the section
    const photoWidth = (width - 60) / 2;

    return (
      <View style={{ marginRight: 10, marginBottom: 10 }}>
        <Pressable
          onLongPress={drag}
          style={{
            width: photoWidth,
            height: photoHeight,
            borderRadius: 12,
            overflow: 'hidden',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 4,
            elevation: 3,
          }}
        >
          <Image
            source={{ uri: item.uri }}
            style={{ width: '100%', height: '100%' }}
            contentFit="cover"
            cachePolicy="memory-disk"
          />

          {/* Remove button */}
          <TouchableOpacity
            onPress={() => handleRemoveFromSelection(index)}
            style={{
              position: 'absolute',
              top: 8,
              right: 8,
              width: 28,
              height: 28,
              borderRadius: 14,
              backgroundColor: 'rgba(0,0,0,0.7)',
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <Text style={{ color: 'white', fontSize: 16, fontWeight: 'bold' }}>×</Text>
          </TouchableOpacity>

          {/* Selection order indicator */}
          <View
            style={{
              position: 'absolute',
              top: 8,
              left: 8,
              width: 28,
              height: 28,
              borderRadius: 14,
              backgroundColor: '#007AFF',
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <Text style={{ color: 'white', fontSize: 14, fontWeight: 'bold' }}>
              {index + 1}
            </Text>
          </View>
        </Pressable>
      </View>
    );
  };

  const renderAlbumItem = ({ item }: { item: Album }) => (
    <TouchableOpacity
      onPress={() => handleAlbumSelect(item)}
      style={{
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E5E5',
        backgroundColor: currentAlbum?.id === item.id ? '#F0F0F0' : '#DCDCDE',
      }}
    >
      <Text style={{ fontSize: 16, fontWeight: '500' }}>{item.title}</Text>
      <Text style={{ fontSize: 14, color: '#666', marginTop: 2 }}>{item.assetCount} photos</Text>
    </TouchableOpacity>
  );

  if (hasPermission === null) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'yellow' }}>
        <Text style={{ fontSize: 30, color: 'red' }}>REQUESTING PERMISSIONS - YELLOW SCREEN</Text>
      </View>
    );
  }

  if (hasPermission === false) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: 'purple' }}>
        <Text style={{ fontSize: 30, color: 'white', marginBottom: 20 }}>
          PERMISSION DENIED - PURPLE SCREEN
        </Text>
        <Text style={{ fontSize: 16, textAlign: 'center', color: 'white', marginBottom: 20 }}>
          Please allow access to your photos to select images for your post.
        </Text>
        <TouchableOpacity
          onPress={requestPermissionsAndLoadPhotos}
          style={{
            backgroundColor: '#007AFF',
            paddingHorizontal: 20,
            paddingVertical: 10,
            borderRadius: 8,
          }}
        >
          <Text style={{ color: 'white', fontSize: 16, fontWeight: '500' }}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: 'red' }}>
      <StatusBar barStyle="dark-content" backgroundColor="red" />

      {/* Header */}
      <Header height={120} showBackButton={true} onBackPress={() => navigation.goBack()} />

      <Text style={{ fontSize: 24, color: 'white', textAlign: 'center', padding: 20, backgroundColor: 'blue' }}>
        TEST - CHANGES ARE WORKING
      </Text>

      {/* STEP 1: Preview Images Section - 50% of screen height - FIRST */}
      <View style={{
        height: SELECTED_SECTION_HEIGHT,
        backgroundColor: '#DCDCDE',
      }}>
        {selectedPhotos.length > 0 ? (
          <DraggableFlatList
            data={selectedPhotos}
            renderItem={renderSelectedPhoto}
            keyExtractor={(item) => item.uri}
            onDragEnd={({ data }) => setSelectedPhotos(data)}
            numColumns={2}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 20, paddingVertical: 20 }}
          />
        ) : (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <Text style={{ fontSize: 16, color: '#666', textAlign: 'center' }}>
              Select photos from below{'\n'}They will appear here
            </Text>
          </View>
        )}
      </View>

      {/* STEP 2: Album Selector - SECOND */}
      <View style={{ backgroundColor: '#DCDCDE', paddingHorizontal: 16, paddingVertical: 12 }}>
        <TouchableOpacity
          onPress={() => setShowAlbums(!showAlbums)}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <View>
            <Text style={{ fontSize: 16, fontWeight: '600' }}>
              {currentAlbum?.title || 'Select Album'}
            </Text>
            <Text style={{ fontSize: 14, color: '#666' }}>{currentAlbum?.assetCount} photos</Text>
          </View>
          <Text style={{ fontSize: 18, color: '#007AFF' }}>{showAlbums ? '▲' : '▼'}</Text>
        </TouchableOpacity>
      </View>

      {/* Albums list */}
      {showAlbums && (
        <View style={{ backgroundColor: '#DCDCDE', maxHeight: 300 }}>
          <FlatList
            data={albums}
            renderItem={renderAlbumItem}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
          />
        </View>
      )}

      {/* Photos grid - Edge to edge */}
      <View style={{ flex: 1, marginBottom: 80 }}>
        {loading ? (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <Text>Loading photos...</Text>
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={photos}
            renderItem={renderPhotoItem}
            keyExtractor={(item) => item.id}
            numColumns={GRID_COLUMNS}
            contentContainerStyle={{}}
            style={{}}
            showsVerticalScrollIndicator={false}
            getItemLayout={(_, index) => ({
              length: PHOTO_SIZE,
              offset: PHOTO_SIZE * Math.floor(index / GRID_COLUMNS),
              index,
            })}
            initialNumToRender={21} // 7 rows of 3 columns
            maxToRenderPerBatch={15} // 5 rows at a time
            windowSize={10} // Keep 10 screens worth of items
            removeClippedSubviews={true}
            updateCellsBatchingPeriod={50}
          />
        )}
      </View>

      {/* Done button - Fixed at bottom */}
      <View style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: '#DCDCDE',
        padding: 16,
        borderTopWidth: 1,
        borderTopColor: '#E5E5E5',
        paddingBottom: 34, // Extra padding for safe area
      }}>
        <TouchableOpacity
          onPress={handleDone}
          style={{
            backgroundColor: selectedPhotos.length > 0 ? '#007AFF' : '#CCC',
            paddingVertical: 12,
            borderRadius: 8,
            alignItems: 'center',
          }}
          disabled={selectedPhotos.length === 0}
        >
          <Text
            style={{
              color: selectedPhotos.length > 0 ? 'white' : '#666',
              fontSize: 16,
              fontWeight: '600',
            }}
          >
            Done ({selectedPhotos.length})
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default PhotoSelectionScreen;
