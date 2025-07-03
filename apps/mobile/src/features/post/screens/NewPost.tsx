import { HashtagInput } from '@/features/hashtags/components/HashtagInput';
import { useUploadMedia } from '@/features/post/hooks/useMedia';
import { useCreatePost } from '@/features/post/hooks/usePosts';
import type { AppStackParamList } from '@/navigation/types';
import Header from '@/shared/components/Header';
import { useAlert } from '@/shared/lib/AlertContext';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useState, useEffect } from 'react';
import {
  FlatList,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
  StatusBar,
} from 'react-native';
import DraggableFlatList from 'react-native-draggable-flatlist';
import { Image } from 'expo-image';
import * as MediaLibrary from 'expo-media-library';

type NavigationProp = NativeStackNavigationProp<AppStackParamList>;
type PostType = 'post' | 'thread';

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

export default function NewPost() {
  const navigation = useNavigation<NavigationProp>();
  const [content, setContent] = useState('');
  const [selectedHashtags, setSelectedHashtags] = useState<Array<{ id: string; name: string }>>([]);
  const [postType, setPostType] = useState<PostType>('post');
  const uploadMediaMutation = useUploadMedia();
  const createPostMutation = useCreatePost();
  const { showAlert } = useAlert();
  const { width } = useWindowDimensions();

  // Photo selection state (for post mode)
  const [photos, setPhotos] = useState<PhotoAsset[]>([]);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [selectedPhotos, setSelectedPhotos] = useState<SelectedPhoto[]>([]);
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<Set<string>>(new Set());
  const [currentAlbum, setCurrentAlbum] = useState<Album | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [showAlbums, setShowAlbums] = useState(false);

  // Constants for photo grid
  const GRID_COLUMNS = 3;
  const GRID_SPACING = 2;
  const PHOTO_SIZE = (width - GRID_SPACING * (GRID_COLUMNS + 1)) / GRID_COLUMNS;
  const PREVIEW_HEIGHT = 80;
  const MAX_PHOTOS = 4;

  // Load photos when switching to post mode
  useEffect(() => {
    if (postType === 'post' && hasPermission === null) {
      requestPermissionsAndLoadPhotos();
    }
  }, [postType, hasPermission]);

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
    setLoading(true);
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

      // Load photos from "Recent" album (first album is usually recent)
      if (albumsWithCount.length > 0) {
        const recentAlbum = albumsWithCount[0];
        setCurrentAlbum(recentAlbum as Album);
        await loadPhotosFromAlbum(recentAlbum.id);
      }
    } catch (error) {
      console.error('Failed to load albums:', error);
      showAlert('Failed to load photo albums', { type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const loadPhotosFromAlbum = async (albumId: string) => {
    try {
      const result = await MediaLibrary.getAssetsAsync({
        album: albumId,
        mediaType: 'photo',
        first: 50,
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

      setPhotos(photoAssets);
    } catch (error) {
      console.error('Failed to load photos:', error);
      showAlert('Failed to load photos', { type: 'error' });
    }
  };

  // Photo selection handlers
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
      if (selectedPhotos.length >= MAX_PHOTOS) {
        showAlert(`Maximum of ${MAX_PHOTOS} photos allowed`, { type: 'warning' });
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

  // Navigate to image edit screen
  const handleSelectedPhotoPress = (photo: SelectedPhoto) => {
    navigation.navigate('ImageEditScreen', { imageUri: photo.uri });
  };

  // Handle next button for photo posts (navigate to PostSettingsScreen)
  const handleNext = () => {
    if (selectedPhotos.length === 0) {
      showAlert('Please select at least one photo', { type: 'warning' });
      return;
    }

    navigation.navigate('PostSettingsScreen', { selectedPhotos });
  };

  // Thread post creation logic (simplified - only for threads now)
  const handleCreateThread = async () => {
    if (!content) {
      showAlert('Please add some content to your thread', { type: 'warning' });
      return;
    }

    try {
      const hashtagIds = selectedHashtags.map((hashtag) => hashtag.id);

      await createPostMutation.mutateAsync({
        content,
        type: 'thread',
        mediaIds: [],
        hashtagIds,
      });

      showAlert('Thread created successfully!', { type: 'success' });
      navigation.goBack();
    } catch (error: any) {
      console.error('Thread creation error:', {
        message: error.message,
        details: error.response?.errors || error,
      });
      showAlert(`Failed to create thread: ${error.message}`, { type: 'error' });
    }
  };

  // Render photo in grid
  const renderPhotoItem = ({ item, index }: { item: PhotoAsset; index: number }) => {
    const isSelected = selectedPhotoIds.has(item.id);
    const selectionIndex = selectedPhotos.findIndex((p) => p.uri === item.uri);

    return (
      <TouchableOpacity
        onPress={() => handlePhotoPress(item)}
        style={{
          width: PHOTO_SIZE,
          height: PHOTO_SIZE,
          marginRight: index % GRID_COLUMNS === GRID_COLUMNS - 1 ? 0 : GRID_SPACING,
          marginBottom: GRID_SPACING,
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
            backgroundColor: isSelected ? '#e4cac7' : 'rgba(0,0,0,0.3)',
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

  // Render selected photo in preview row
  const renderSelectedPhoto = ({ item, index, drag }: any) => (
    <View style={{ marginRight: 8 }}>
      <Pressable
        onPress={() => handleSelectedPhotoPress(item)}
        onLongPress={drag}
        style={{
          width: PREVIEW_HEIGHT,
          height: PREVIEW_HEIGHT,
          borderRadius: 8,
          overflow: 'hidden',
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
            top: -4,
            right: -4,
            width: 20,
            height: 20,
            borderRadius: 10,
            backgroundColor: 'rgba(0,0,0,0.7)',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <Text style={{ color: 'white', fontSize: 12, fontWeight: 'bold' }}>×</Text>
        </TouchableOpacity>
      </Pressable>
    </View>
  );

  return (
    <View className="flex-1 bg-[#DCDCDE] rounded-[30px]">
      <Header height={120} showBackButton={true} onBackPress={() => navigation.goBack()} />

      <ScrollView className="flex-1">
        <View className="flex-1 p-5">
          {/* Type Selector */}
          <View className="w-full h-10 mb-5 rounded-lg flex-row justify-center items-center overflow-hidden bg-white/10 shadow">
            <TouchableOpacity
              className={`flex-1 mx-1 h-8 rounded-md flex justify-center items-center ${postType === 'post' ? 'bg-[#a99ca3]' : 'bg-[#dcdcde]'}`}
              onPress={() => setPostType('post')}
            >
              <Text
                className={`text-center text-xs ${postType === 'post' ? 'text-white font-semibold' : 'text-black font-normal'}`}
              >
                Photo/Video
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              className={`flex-1 mx-1 h-8 rounded-md flex justify-center items-center ${postType === 'thread' ? 'bg-[#a99ca3]' : 'bg-[#dcdcde]'}`}
              onPress={() => setPostType('thread')}
            >
              <Text
                className={`text-center text-xs ${postType === 'thread' ? 'text-white font-semibold' : 'text-black font-normal'}`}
              >
                Thread
              </Text>
            </TouchableOpacity>
          </View>

          {/* Dynamic Content Based on Post Type */}
          {postType === 'post' ? (
            /* Photo Grid Mode */
            <View>
              {/* Album Selector */}
              {hasPermission && currentAlbum && (
                <View className="bg-white rounded-lg p-3 mb-4 shadow">
                  <TouchableOpacity
                    onPress={() => setShowAlbums(!showAlbums)}
                    className="flex-row justify-between items-center"
                  >
                    <View>
                      <Text className="font-semibold text-base">{currentAlbum.title}</Text>
                      <Text className="text-gray-500 text-sm">
                        {currentAlbum.assetCount} photos
                      </Text>
                    </View>
                    <Text className="text-blue-600 text-lg">{showAlbums ? '▲' : '▼'}</Text>
                  </TouchableOpacity>

                  {/* Albums List */}
                  {showAlbums && (
                    <View className="mt-3 max-h-40">
                      <FlatList
                        data={albums}
                        keyExtractor={(item) => item.id}
                        renderItem={({ item }) => (
                          <TouchableOpacity
                            onPress={() => handleAlbumSelect(item)}
                            className="py-2 px-3 border-b border-gray-200"
                          >
                            <Text className="font-medium">{item.title}</Text>
                            <Text className="text-gray-500 text-xs">{item.assetCount} photos</Text>
                          </TouchableOpacity>
                        )}
                        showsVerticalScrollIndicator={false}
                      />
                    </View>
                  )}
                </View>
              )}

              {/* Selected Photos Preview */}
              {selectedPhotos.length > 0 && (
                <View className="bg-white rounded-lg p-3 mb-4 shadow">
                  <Text className="font-semibold text-base mb-2">
                    Selected ({selectedPhotos.length}/{MAX_PHOTOS})
                  </Text>
                  <DraggableFlatList
                    data={selectedPhotos}
                    renderItem={renderSelectedPhoto}
                    keyExtractor={(item) => item.uri}
                    onDragEnd={({ data }) => setSelectedPhotos(data)}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                  />
                </View>
              )}

              {/* Photo Grid */}
              {hasPermission === null ? (
                <View className="flex-1 justify-center items-center p-8">
                  <Text className="text-gray-600">Requesting permissions...</Text>
                </View>
              ) : hasPermission === false ? (
                <View className="flex-1 justify-center items-center p-8">
                  <Text className="text-lg font-semibold mb-4">Photo Access Required</Text>
                  <Text className="text-gray-600 text-center mb-6">
                    Please allow access to your photos to select images for your post.
                  </Text>
                  <TouchableOpacity
                    onPress={requestPermissionsAndLoadPhotos}
                    className="bg-blue-600 rounded-lg px-6 py-3"
                  >
                    <Text className="text-white font-semibold">Grant Permission</Text>
                  </TouchableOpacity>
                </View>
              ) : loading ? (
                <View className="flex-1 justify-center items-center p-8">
                  <Text className="text-gray-600">Loading photos...</Text>
                </View>
              ) : (
                <FlatList
                  data={photos}
                  renderItem={renderPhotoItem}
                  keyExtractor={(item) => item.id}
                  numColumns={GRID_COLUMNS}
                  contentContainerStyle={{ padding: GRID_SPACING }}
                  showsVerticalScrollIndicator={false}
                  style={{ maxHeight: 400 }}
                />
              )}

              {/* Next Button */}
              {selectedPhotos.length > 0 && (
                <TouchableOpacity
                  className="bg-[#e4cac7] rounded-[30px] shadow px-6 py-3 mt-4"
                  onPress={handleNext}
                >
                  <Text className="text-black text-center font-bold text-base">Next</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            /* Thread Content Mode */
            <View className="mt-2 bg-[#dcdcde] p-4 rounded-lg shadow">
              <TextInput
                className="border border-gray-300 rounded-lg p-3 mb-3 bg-[#dcdcde]"
                placeholder="What's on your mind?"
                value={content}
                onChangeText={setContent}
                multiline
                maxLength={800}
              />
              <Text className="text-right text-gray-500 mb-2">{content.length}/800</Text>

              {/* Hashtags */}
              <HashtagInput
                selectedHashtags={selectedHashtags}
                onHashtagsChange={setSelectedHashtags}
                maxHashtags={5}
              />

              {/* Post Button */}
              <TouchableOpacity
                className="bg-[#e4cac7] rounded-[30px] shadow px-6 py-3 mt-2"
                onPress={handleCreateThread}
                disabled={createPostMutation.isPending}
              >
                <Text className="text-black text-center font-bold text-base">
                  {createPostMutation.isPending ? 'Creating...' : 'Post'}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
