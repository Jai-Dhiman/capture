import { useCreateHashtag, useSearchHashtags } from '@/features/post/hooks/useHashtags';
import { useAlert } from '@/shared/lib/AlertContext';
import { errorService } from '@/shared/services/errorService';
import { debounce } from 'lodash';
import React, { useState, useEffect, useCallback } from 'react';
import { ActivityIndicator, FlatList, Text, TextInput, TouchableOpacity, View } from 'react-native';

interface HashtagInputProps {
  selectedHashtags: Array<{ id: string; name: string }>;
  onHashtagsChange: (hashtags: Array<{ id: string; name: string }>) => void;
  maxHashtags?: number;
}

export const HashtagInput = ({
  selectedHashtags,
  onHashtagsChange,
  maxHashtags = 5,
}: HashtagInputProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const { showAlert } = useAlert();

  const { data: searchResults, isLoading, refetch } = useSearchHashtags(searchQuery, isSearching);

  const createHashtagMutation = useCreateHashtag();

  const debouncedSearch = useCallback(
    debounce((query: string) => {
      if (query.trim()) {
        setIsSearching(true);
        refetch();
      } else {
        setIsSearching(false);
      }
    }, 500),
    [],
  );

  useEffect(() => {
    debouncedSearch(searchQuery);
    return () => debouncedSearch.cancel();
  }, [searchQuery, debouncedSearch]);

  const handleSelectHashtag = (hashtag: { id: string; name: string }) => {
    if (selectedHashtags.some((c) => c.id === hashtag.id)) {
      return;
    }

    if (selectedHashtags.length >= maxHashtags) {
      showAlert(`You can only add up to ${maxHashtags} hashtags per post.`, { type: 'warning' });
      return;
    }

    onHashtagsChange([...selectedHashtags, hashtag]);
    setSearchQuery('');
    setIsSearching(false);
  };

  const handleRemoveHashtag = (hashtagId: string) => {
    onHashtagsChange(selectedHashtags.filter((c) => c.id !== hashtagId));
  };

  const handleCreateHashtag = async () => {
    if (!searchQuery.trim()) return;

    try {
      const newHashtag = await createHashtagMutation.mutateAsync(searchQuery);
      handleSelectHashtag(newHashtag);
    } catch (error) {
      console.error(error);
      const appError = errorService.createError(
        'Failed to create new hashtag',
        'server/hashtag-error',
        error instanceof Error ? error : undefined,
      );

      showAlert(appError.message, {
        type: errorService.getAlertType(appError.category),
      });
    }
  };

  return (
    <View className="mb-4">
      <View className="flex-row flex-wrap mb-2">
        {selectedHashtags.map((hashtag) => (
          <View
            key={hashtag.id}
            className="flex-row items-center bg-blue-100 rounded-full px-3 py-1 mr-2 mb-2"
          >
            <Text className="text-blue-700 mr-1">#{hashtag.name}</Text>
            <TouchableOpacity onPress={() => handleRemoveHashtag(hashtag.id)}>
              <Text className="text-blue-700 font-bold">×</Text>
            </TouchableOpacity>
          </View>
        ))}
      </View>

      {selectedHashtags.length < maxHashtags && (
        <View>
          <TextInput
            className="border border-gray-300 rounded-lg p-2 mb-2"
            placeholder="Search Hashtags..."
            value={searchQuery}
            onChangeText={setSearchQuery}
          />

          {isSearching && (
            <View className="border border-gray-200 rounded-lg mb-2 max-h-40">
              {isLoading ? (
                <View className="p-3 items-center">
                  <ActivityIndicator />
                </View>
              ) : searchResults && searchResults.length > 0 ? (
                <FlatList
                  data={searchResults.slice(0, 3)}
                  keyExtractor={(item) => item.id}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      className="p-3 border-b border-gray-100"
                      onPress={() => handleSelectHashtag(item)}
                    >
                      <Text>#{item.name}</Text>
                    </TouchableOpacity>
                  )}
                  ListFooterComponent={
                    searchQuery.trim() ? (
                      <TouchableOpacity
                        className="p-3 bg-gray-50"
                        onPress={handleCreateHashtag}
                        disabled={createHashtagMutation.isPending}
                      >
                        <Text className="text-blue-600">
                          {createHashtagMutation.isPending
                            ? 'Creating...'
                            : `Create #${searchQuery}`}
                        </Text>
                      </TouchableOpacity>
                    ) : null
                  }
                />
              ) : searchQuery.trim() ? (
                <View>
                  <TouchableOpacity
                    className="p-3 bg-gray-50"
                    onPress={handleCreateHashtag}
                    disabled={createHashtagMutation.isPending}
                  >
                    <Text className="text-blue-600">
                      {createHashtagMutation.isPending ? 'Creating...' : `Create #${searchQuery}`}
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : null}
            </View>
          )}

          <Text className="text-xs text-gray-500">
            {selectedHashtags.length}/{maxHashtags} Hashtags used
          </Text>
        </View>
      )}
    </View>
  );
};
