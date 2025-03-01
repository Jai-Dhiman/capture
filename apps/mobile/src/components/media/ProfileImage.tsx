import React, { useEffect } from 'react';
import { View, Text, Image } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { API_URL } from '@env';

interface ProfileImageProps {
  cloudflareId: string;
  style?: any;
  expirySeconds?: number;
}

export const ProfileImage = ({ cloudflareId, style = {}, expirySeconds = 1800 }: ProfileImageProps) => {
  const queryClient = useQueryClient();
  
  const { data: imageUrl, isLoading, error, isStale } = useQuery({
    queryKey: ['cloudflareImageUrl', cloudflareId, expirySeconds],
    queryFn: async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error('No auth token available');
      }

      const response = await fetch(`${API_URL}/api/media/cloudflare/${cloudflareId}/url?expiry=${expirySeconds}`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch image URL');
      }

      const data = await response.json();
      return data.url;
    },
    enabled: !!cloudflareId,
    staleTime: Math.min(expirySeconds * 1000 * 0.8, 20 * 60 * 1000),
  });
  
  useEffect(() => {
    if (imageUrl && !isStale) {
      const refreshTime = expirySeconds * 0.8 * 1000;
      const timer = setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['cloudflareImageUrl', cloudflareId, expirySeconds] });
      }, refreshTime);
      
      return () => clearTimeout(timer);
    }
  }, [imageUrl, cloudflareId, expirySeconds, isStale, queryClient]);
  
  if (isLoading) {
    return <View className="bg-gray-200 flex-1 rounded-lg"><Text className="text-center p-2">Loading...</Text></View>;
  }

  if (error || !imageUrl) {
    return <View className="bg-gray-200 flex-1 rounded-lg"><Text className="text-center p-2">Failed to load</Text></View>;
  }

  return (
    <Image
      source={{ uri: imageUrl }}
      className="flex-1 rounded-lg"
      style={style}
      resizeMode="cover"
    />
  );
};