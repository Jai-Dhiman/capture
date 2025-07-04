import { atom } from 'jotai';
import { atomWithStorage } from 'jotai/utils';
import { atomWithMutation } from 'jotai-tanstack-query';
import { useAuthStore } from '@/features/auth/stores/authStore';
import { errorService } from '@/shared/services/errorService';
import { API_URL } from '@env';

// Types for post creation state
export interface SelectedPhoto {
  uri: string;
  type: string;
  name: string;
  order: number;
}

export interface PostSettings {
  type: 'post' | 'thread';
  privacy: 'public' | 'followers' | 'private';
  allowComments: boolean;
  allowSharing: boolean;
}

export interface PostDraft {
  id: string;
  content: string;
  selectedPhotos: SelectedPhoto[];
  selectedHashtags: Array<{ id: string; name: string }>;
  settings: PostSettings;
  createdAt: string;
  updatedAt: string;
}

// Basic post creation atoms
export const postContentAtom = atom<string>('');
export const selectedPhotosAtom = atom<SelectedPhoto[]>([]);
export const selectedHashtagsAtom = atom<Array<{ id: string; name: string }>>([]);

// Post settings atom with default values
export const postSettingsAtom = atom<PostSettings>({
  type: 'post',
  privacy: 'public',
  allowComments: true,
  allowSharing: true,
});

// UI state atoms
export const isCreatingPostAtom = atom<boolean>(false);
export const postCreationErrorAtom = atom<string | null>(null);
export const currentStepAtom = atom<'content' | 'photos' | 'settings' | 'preview'>('content');

// Draft management atoms (persistent)
export const currentDraftIdAtom = atomWithStorage<string | null>('currentDraftId', null);
export const draftsAtom = atomWithStorage<Record<string, PostDraft>>('postDrafts', {});

// Derived atoms
export const currentDraftAtom = atom(
  (get) => {
    const draftId = get(currentDraftIdAtom);
    const drafts = get(draftsAtom);
    return draftId ? drafts[draftId] || null : null;
  },
  (get, set, draft: PostDraft | null) => {
    const drafts = get(draftsAtom);

    if (draft) {
      // Update or create draft
      set(draftsAtom, {
        ...drafts,
        [draft.id]: {
          ...draft,
          updatedAt: new Date().toISOString(),
        },
      });
      set(currentDraftIdAtom, draft.id);
    } else {
      // Clear current draft
      set(currentDraftIdAtom, null);
    }
  },
);

// Create a new draft atom
export const createNewDraftAtom = atom(null, (get, set) => {
  const newDraft: PostDraft = {
    id: `draft_${Date.now()}`,
    content: '',
    selectedPhotos: [],
    selectedHashtags: [],
    settings: {
      type: 'post',
      privacy: 'public',
      allowComments: true,
      allowSharing: true,
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  set(currentDraftAtom, newDraft);

  // Reset form atoms to draft values
  set(postContentAtom, newDraft.content);
  set(selectedPhotosAtom, newDraft.selectedPhotos);
  set(selectedHashtagsAtom, newDraft.selectedHashtags);
  set(postSettingsAtom, newDraft.settings);
  set(currentStepAtom, 'content');

  return newDraft;
});

// Load draft atom
export const loadDraftAtom = atom(null, (get, set, draftId: string) => {
  const drafts = get(draftsAtom);
  const draft = drafts[draftId];

  if (draft) {
    set(currentDraftIdAtom, draftId);
    set(postContentAtom, draft.content);
    set(selectedPhotosAtom, draft.selectedPhotos);
    set(selectedHashtagsAtom, draft.selectedHashtags);
    set(postSettingsAtom, draft.settings);
  }
});

// Save current form state to draft atom
export const saveToDraftAtom = atom(null, (get, set) => {
  const content = get(postContentAtom);
  const photos = get(selectedPhotosAtom);
  const hashtags = get(selectedHashtagsAtom);
  const settings = get(postSettingsAtom);
  const currentDraft = get(currentDraftAtom);

  // Only save if there's actual content
  if (content.trim() || photos.length > 0 || hashtags.length > 0) {
    const draftId = currentDraft?.id || `draft_${Date.now()}`;

    const updatedDraft: PostDraft = {
      id: draftId,
      content,
      selectedPhotos: photos,
      selectedHashtags: hashtags,
      settings,
      createdAt: currentDraft?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    set(currentDraftAtom, updatedDraft);
  }
});

// Delete draft atom
export const deleteDraftAtom = atom(null, (get, set, draftId: string) => {
  const drafts = get(draftsAtom);
  const { [draftId]: deletedDraft, ...remainingDrafts } = drafts;

  set(draftsAtom, remainingDrafts);

  // If deleting current draft, clear current draft ID
  const currentDraftId = get(currentDraftIdAtom);
  if (currentDraftId === draftId) {
    set(currentDraftIdAtom, null);
  }
});

// Clear all form data atom
export const clearFormAtom = atom(null, (get, set) => {
  set(postContentAtom, '');
  set(selectedPhotosAtom, []);
  set(selectedHashtagsAtom, []);
  set(postSettingsAtom, {
    type: 'post',
    privacy: 'public',
    allowComments: true,
    allowSharing: true,
  });
  set(currentStepAtom, 'content');
  set(postCreationErrorAtom, null);
  set(currentDraftIdAtom, null);
});

// Validation atoms
export const isFormValidAtom = atom((get) => {
  const content = get(postContentAtom);
  const photos = get(selectedPhotosAtom);
  const settings = get(postSettingsAtom);

  if (settings.type === 'thread') {
    return content.trim().length > 0;
  }
  return content.trim().length > 0 || photos.length > 0;
});

export const contentCharacterCountAtom = atom((get) => {
  const content = get(postContentAtom);
  const settings = get(postSettingsAtom);
  const maxLength = settings.type === 'post' ? 500 : 800;

  return {
    current: content.length,
    max: maxLength,
    remaining: maxLength - content.length,
    isValid: content.length <= maxLength,
  };
});

// Photo management derived atoms
export const canAddMorePhotosAtom = atom((get) => {
  const photos = get(selectedPhotosAtom);
  return photos.length < 4;
});

export const remainingPhotoSlotsAtom = atom((get) => {
  const photos = get(selectedPhotosAtom);
  return 4 - photos.length;
});

// Add photo atom
export const addPhotosAtom = atom(null, (get, set, newPhotos: SelectedPhoto[]) => {
  const currentPhotos = get(selectedPhotosAtom);
  const remainingSlots = get(remainingPhotoSlotsAtom);

  // Only add photos if we have space
  const photosToAdd = newPhotos.slice(0, remainingSlots);
  const updatedPhotos = [...currentPhotos, ...photosToAdd];

  set(selectedPhotosAtom, updatedPhotos);

  // Auto-save to draft
  set(saveToDraftAtom);
});

// Remove photo atom
export const removePhotoAtom = atom(null, (get, set, index: number) => {
  const photos = get(selectedPhotosAtom);
  const updatedPhotos = photos.filter((_, i) => i !== index);
  set(selectedPhotosAtom, updatedPhotos);

  // Auto-save to draft
  set(saveToDraftAtom);
});

// Reorder photos atom
export const reorderPhotosAtom = atom(null, (get, set, reorderedPhotos: SelectedPhoto[]) => {
  set(selectedPhotosAtom, reorderedPhotos);

  // Auto-save to draft
  set(saveToDraftAtom);
});

// Add hashtag atom
export const addHashtagAtom = atom(null, (get, set, hashtag: { id: string; name: string }) => {
  const hashtags = get(selectedHashtagsAtom);

  // Don't add duplicate hashtags
  if (!hashtags.find((h) => h.id === hashtag.id)) {
    set(selectedHashtagsAtom, [...hashtags, hashtag]);

    // Auto-save to draft
    set(saveToDraftAtom);
  }
});

// Remove hashtag atom
export const removeHashtagAtom = atom(null, (get, set, hashtagId: string) => {
  const hashtags = get(selectedHashtagsAtom);
  const updatedHashtags = hashtags.filter((h) => h.id !== hashtagId);
  set(selectedHashtagsAtom, updatedHashtags);

  // Auto-save to draft
  set(saveToDraftAtom);
});

// Navigation atoms
export const nextStepAtom = atom(null, (get, set) => {
  const currentStep = get(currentStepAtom);
  const settings = get(postSettingsAtom);

  switch (currentStep) {
    case 'content':
      // For threads, skip photos step
      if (settings.type === 'thread') {
        set(currentStepAtom, 'settings');
      } else {
        set(currentStepAtom, 'photos');
      }
      break;
    case 'photos':
      set(currentStepAtom, 'settings');
      break;
    case 'settings':
      set(currentStepAtom, 'preview');
      break;
    default:
      break;
  }
});

export const previousStepAtom = atom(null, (get, set) => {
  const currentStep = get(currentStepAtom);
  const settings = get(postSettingsAtom);

  switch (currentStep) {
    case 'photos':
      set(currentStepAtom, 'content');
      break;
    case 'settings':
      // For threads, go back to content, otherwise photos
      if (settings.type === 'thread') {
        set(currentStepAtom, 'content');
      } else {
        set(currentStepAtom, 'photos');
      }
      break;
    case 'preview':
      set(currentStepAtom, 'settings');
      break;
    default:
      break;
  }
});

// Get all drafts list atom
export const draftsListAtom = atom((get) => {
  const drafts = get(draftsAtom);
  return Object.values(drafts).sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
});

// Draft count atom
export const draftCountAtom = atom((get) => {
  const drafts = get(draftsAtom);
  return Object.keys(drafts).length;
});

// Async atoms for API interactions
export const uploadMediaMutationAtom = atomWithMutation(() => {
  return {
    mutationKey: ['uploadMedia'],
    mutationFn: async (selectedPhotos: SelectedPhoto[]) => {
      const { session } = useAuthStore.getState();

      if (!session?.access_token) {
        throw errorService.createError('No auth token available', 'auth/no-token');
      }

      if (selectedPhotos.length === 0) {
        return [];
      }

      try {
        const uploadPromises = selectedPhotos.map(async (photo, index) => {
          const formData = new FormData();
          formData.append('file', {
            uri: photo.uri,
            type: photo.type,
            name: photo.name,
          } as any);
          formData.append('order', index.toString());

          const response = await fetch(`${API_URL}/media/upload`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${session.access_token}`,
              'Content-Type': 'multipart/form-data',
            },
            body: formData,
          });

          if (!response.ok) {
            throw new Error(`Upload failed for ${photo.name}`);
          }

          return response.json();
        });

        return Promise.all(uploadPromises);
      } catch (error) {
        throw errorService.createError(
          'Failed to upload media files',
          'network/upload-failed',
          error instanceof Error ? error : undefined,
        );
      }
    },
  };
});

export const createPostMutationAtom = atomWithMutation(() => {
  return {
    mutationKey: ['createPost'],
    mutationFn: async ({
      content,
      type,
      mediaIds = [],
      hashtagIds = [],
      settings,
    }: {
      content: string;
      type: 'post' | 'thread';
      mediaIds?: string[];
      hashtagIds?: string[];
      settings: PostSettings;
    }) => {
      const { session } = useAuthStore.getState();

      if (!session?.access_token) {
        throw errorService.createError('No auth token available', 'auth/no-token');
      }

      try {
        const response = await fetch(`${API_URL}/graphql`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            query: `
              mutation CreatePost($input: PostInput!) {
                createPost(input: $input) {
                  id
                  content
                  type
                  createdAt
                  user {
                    id
                    username
                    profileImage
                  }
                  media {
                    id
                    url
                    type
                    width
                    height
                  }
                  hashtags {
                    id
                    name
                  }
                  settings {
                    privacy
                    allowComments
                    allowSharing
                  }
                }
              }
            `,
            variables: {
              input: {
                content,
                type,
                mediaIds,
                hashtagIds,
                privacy: settings.privacy,
                allowComments: settings.allowComments,
                allowSharing: settings.allowSharing,
              },
            },
          }),
        });

        const data = await response.json();

        if (data.errors) {
          console.error('GraphQL errors:', data.errors);
          throw errorService.createError(
            data.errors[0].message || 'Failed to create post',
            'server/graphql-error',
          );
        }

        return data.data.createPost;
      } catch (error) {
        throw errorService.createError(
          'Failed to create post',
          'network/post-failed',
          error instanceof Error ? error : undefined,
        );
      }
    },
  };
});

export const saveDraftMutationAtom = atomWithMutation(() => {
  return {
    mutationKey: ['saveDraft'],
    mutationFn: async (draft: PostDraft) => {
      const { session } = useAuthStore.getState();

      if (!session?.access_token) {
        throw errorService.createError('No auth token available', 'auth/no-token');
      }

      try {
        const response = await fetch(`${API_URL}/drafts`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            id: draft.id,
            content: draft.content,
            selectedPhotos: draft.selectedPhotos,
            selectedHashtags: draft.selectedHashtags,
            settings: draft.settings,
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to save draft to server');
        }

        return response.json();
      } catch (error) {
        // If server save fails, we still have local storage, so just log the error
        console.warn('Failed to save draft to server:', error);
        throw errorService.createError(
          'Failed to sync draft to server',
          'network/sync-failed',
          error instanceof Error ? error : undefined,
        );
      }
    },
  };
});

export const loadServerDraftsMutationAtom = atomWithMutation(() => {
  return {
    mutationKey: ['loadServerDrafts'],
    mutationFn: async () => {
      const { session } = useAuthStore.getState();

      if (!session?.access_token) {
        throw errorService.createError('No auth token available', 'auth/no-token');
      }

      try {
        const response = await fetch(`${API_URL}/drafts`, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });

        if (!response.ok) {
          throw new Error('Failed to load drafts from server');
        }

        const serverDrafts = await response.json();
        return serverDrafts;
      } catch (error) {
        throw errorService.createError(
          'Failed to load server drafts',
          'network/fetch-failed',
          error instanceof Error ? error : undefined,
        );
      }
    },
  };
});

// Compound atom for creating a post with media upload
export const createPostWithMediaAtom = atom(null, async (get, set) => {
  try {
    set(isCreatingPostAtom, true);
    set(postCreationErrorAtom, null);

    const content = get(postContentAtom);
    const photos = get(selectedPhotosAtom);
    const hashtags = get(selectedHashtagsAtom);
    const settings = get(postSettingsAtom);

    // Validate form
    const isValid = get(isFormValidAtom);
    if (!isValid) {
      throw errorService.createError('Please fill in all required fields', 'validation/incomplete');
    }

    let mediaIds: string[] = [];

    // Upload media if we have photos
    if (photos.length > 0) {
      const uploadMutation = get(uploadMediaMutationAtom);
      const uploadedMedia = await uploadMutation.mutateAsync(photos);
      mediaIds = uploadedMedia.map((media: any) => media.id);
    }

    // Create the post
    const createMutation = get(createPostMutationAtom);
    const hashtagIds = hashtags.map((h) => h.id);

    const result = await createMutation.mutateAsync({
      content,
      type: settings.type,
      mediaIds,
      hashtagIds,
      settings,
    });

    // Clear form and draft on successful post creation
    set(clearFormAtom);

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to create post';
    set(postCreationErrorAtom, errorMessage);
    throw error;
  } finally {
    set(isCreatingPostAtom, false);
  }
});

// Auto-save draft atom (throttled)
let autoSaveTimeout: NodeJS.Timeout | null = null;

export const autoSaveDraftAtom = atom(null, (get, set) => {
  // Clear existing timeout
  if (autoSaveTimeout) {
    clearTimeout(autoSaveTimeout);
  }

  // Set new timeout for auto-save
  autoSaveTimeout = setTimeout(() => {
    set(saveToDraftAtom);
  }, 2000); // Auto-save after 2 seconds of inactivity
});
