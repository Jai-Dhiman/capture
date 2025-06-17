import { followingMapAtom } from '@/features/profile/atoms/followingAtoms';
import type { FollowingState } from '@/features/profile/types/followingTypes';
import { useQueryClient } from '@tanstack/react-query';
import { useAtom } from 'jotai';
import React, { useEffect } from 'react';

export const JotaiInitializer = () => {
  const [_, setFollowingMap] = useAtom(followingMapAtom);
  const queryClient = useQueryClient();

  useEffect(() => {
    const jotaiState = queryClient.getQueryData(['jotai']) as FollowingState | undefined;

    if (jotaiState?.followingMap) {
      setFollowingMap(jotaiState.followingMap);
    }

    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      if (event.type === 'updated' && event.query.queryKey[0] === 'profile') {
        const profileData = event.query.state.data;

        if (profileData?.userId && profileData?.isFollowing !== undefined) {
          setFollowingMap((prev) => ({
            ...prev,
            [profileData.userId]: profileData.isFollowing,
          }));
        }
      }
    });

    return () => {
      unsubscribe();
    };
  }, [queryClient, setFollowingMap]);

  return null;
};
