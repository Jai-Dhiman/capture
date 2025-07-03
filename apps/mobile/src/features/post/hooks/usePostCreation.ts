import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { useCallback } from 'react';
import {
  // Basic state atoms
  postContentAtom,
  selectedPhotosAtom,
  selectedHashtagsAtom,
  postSettingsAtom,
  currentStepAtom,
  // UI state atoms
  isCreatingPostAtom,
  postCreationErrorAtom,
  // Draft management atoms
  currentDraftAtom,
  currentDraftIdAtom,
  draftsListAtom,
  draftCountAtom,
  // Derived atoms
  isFormValidAtom,
  contentCharacterCountAtom,
  canAddMorePhotosAtom,
  remainingPhotoSlotsAtom,
  // Action atoms
  createNewDraftAtom,
  loadDraftAtom,
  saveToDraftAtom,
  deleteDraftAtom,
  clearFormAtom,
  addPhotosAtom,
  removePhotoAtom,
  reorderPhotosAtom,
  addHashtagAtom,
  removeHashtagAtom,
  nextStepAtom,
  previousStepAtom,
  createPostWithMediaAtom,
  autoSaveDraftAtom,
  // Async atoms
  uploadMediaMutationAtom,
  createPostMutationAtom,
  saveDraftMutationAtom,
  // Types
  type SelectedPhoto,
  type PostSettings,
  type PostDraft,
} from '../atoms/postCreationAtoms';

/**
 * Central hook for post creation state management
 * Provides a clean interface to all post creation atoms and actions
 */
export const usePostCreation = () => {
  // Basic state
  const [content, setContent] = useAtom(postContentAtom);
  const [selectedPhotos, setSelectedPhotos] = useAtom(selectedPhotosAtom);
  const [selectedHashtags, setSelectedHashtags] = useAtom(selectedHashtagsAtom);
  const [settings, setSettings] = useAtom(postSettingsAtom);
  const [currentStep, setCurrentStep] = useAtom(currentStepAtom);

  // UI state
  const isCreating = useAtomValue(isCreatingPostAtom);
  const error = useAtomValue(postCreationErrorAtom);
  const setError = useSetAtom(postCreationErrorAtom);

  // Draft state
  const [currentDraft, setCurrentDraft] = useAtom(currentDraftAtom);
  const currentDraftId = useAtomValue(currentDraftIdAtom);
  const draftsList = useAtomValue(draftsListAtom);
  const draftCount = useAtomValue(draftCountAtom);

  // Validation
  const isFormValid = useAtomValue(isFormValidAtom);
  const characterCount = useAtomValue(contentCharacterCountAtom);
  const canAddMorePhotos = useAtomValue(canAddMorePhotosAtom);
  const remainingPhotoSlots = useAtomValue(remainingPhotoSlotsAtom);

  // Action setters
  const createNewDraft = useSetAtom(createNewDraftAtom);
  const loadDraft = useSetAtom(loadDraftAtom);
  const saveToDraft = useSetAtom(saveToDraftAtom);
  const deleteDraft = useSetAtom(deleteDraftAtom);
  const clearForm = useSetAtom(clearFormAtom);
  const addPhotos = useSetAtom(addPhotosAtom);
  const removePhoto = useSetAtom(removePhotoAtom);
  const reorderPhotos = useSetAtom(reorderPhotosAtom);
  const addHashtag = useSetAtom(addHashtagAtom);
  const removeHashtag = useSetAtom(removeHashtagAtom);
  const nextStep = useSetAtom(nextStepAtom);
  const previousStep = useSetAtom(previousStepAtom);
  const createPostWithMedia = useSetAtom(createPostWithMediaAtom);
  const autoSaveDraft = useSetAtom(autoSaveDraftAtom);

  // Async mutations
  const uploadMediaMutation = useAtomValue(uploadMediaMutationAtom);
  const createPostMutation = useAtomValue(createPostMutationAtom);
  const saveDraftMutation = useAtomValue(saveDraftMutationAtom);

  // Utility functions
  const updateContent = useCallback(
    (newContent: string) => {
      setContent(newContent);
      autoSaveDraft(); // Auto-save on content change
    },
    [setContent, autoSaveDraft],
  );

  const updateSettings = useCallback(
    (newSettings: Partial<PostSettings>) => {
      setSettings((prev) => ({ ...prev, ...newSettings }));
      autoSaveDraft(); // Auto-save on settings change
    },
    [setSettings, autoSaveDraft],
  );

  const addPhotosWithValidation = useCallback(
    (newPhotos: SelectedPhoto[]) => {
      if (!canAddMorePhotos) {
        setError('Maximum of 4 photos allowed per post');
        return false;
      }

      addPhotos(newPhotos);
      return true;
    },
    [canAddMorePhotos, addPhotos, setError],
  );

  const addHashtagWithValidation = useCallback(
    (hashtag: { id: string; name: string }) => {
      if (selectedHashtags.length >= 5) {
        setError('Maximum of 5 hashtags allowed per post');
        return false;
      }

      addHashtag(hashtag);
      return true;
    },
    [selectedHashtags.length, addHashtag, setError],
  );

  const createPost = useCallback(async () => {
    try {
      setError(null);
      const result = await createPostWithMedia();
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create post';
      setError(errorMessage);
      throw error;
    }
  }, [createPostWithMedia, setError]);

  const createDraft = useCallback(() => {
    const draft = createNewDraft();
    return draft;
  }, [createNewDraft]);

  const loadExistingDraft = useCallback(
    (draftId: string) => {
      loadDraft(draftId);
    },
    [loadDraft],
  );

  const saveCurrentDraft = useCallback(() => {
    saveToDraft();
  }, [saveToDraft]);

  const deleteDraftById = useCallback(
    (draftId: string) => {
      deleteDraft(draftId);
    },
    [deleteDraft],
  );

  const clearError = useCallback(() => {
    setError(null);
  }, [setError]);

  const goToNextStep = useCallback(() => {
    nextStep();
  }, [nextStep]);

  const goToPreviousStep = useCallback(() => {
    previousStep();
  }, [previousStep]);

  const goToStep = useCallback(
    (step: 'content' | 'photos' | 'settings' | 'preview') => {
      setCurrentStep(step);
    },
    [setCurrentStep],
  );

  // Post type switching with auto-save
  const switchPostType = useCallback(
    (type: 'post' | 'thread') => {
      updateSettings({ type });

      // If switching to thread, skip photos step if currently on it
      if (type === 'thread' && currentStep === 'photos') {
        setCurrentStep('settings');
      }
    },
    [updateSettings, currentStep, setCurrentStep],
  );

  return {
    // State
    content,
    selectedPhotos,
    selectedHashtags,
    settings,
    currentStep,

    // UI State
    isCreating,
    error,

    // Draft state
    currentDraft,
    currentDraftId,
    draftsList,
    draftCount,

    // Validation
    isFormValid,
    characterCount,
    canAddMorePhotos,
    remainingPhotoSlots,

    // Mutations
    uploadMediaMutation,
    createPostMutation,
    saveDraftMutation,

    // Actions
    updateContent,
    updateSettings,
    setSelectedPhotos,
    setSelectedHashtags,
    addPhotosWithValidation,
    removePhoto,
    reorderPhotos,
    addHashtagWithValidation,
    removeHashtag,

    // Navigation
    goToNextStep,
    goToPreviousStep,
    goToStep,

    // Post management
    createPost,
    switchPostType,

    // Draft management
    createDraft,
    loadExistingDraft,
    saveCurrentDraft,
    deleteDraftById,

    // Form management
    clearForm,
    clearError,
    autoSaveDraft,
  };
};

/**
 * Hook for accessing only the draft management functionality
 */
export const useDraftManagement = () => {
  const draftsList = useAtomValue(draftsListAtom);
  const draftCount = useAtomValue(draftCountAtom);
  const currentDraftId = useAtomValue(currentDraftIdAtom);

  const createNewDraft = useSetAtom(createNewDraftAtom);
  const loadDraft = useSetAtom(loadDraftAtom);
  const deleteDraft = useSetAtom(deleteDraftAtom);
  const saveToDraft = useSetAtom(saveToDraftAtom);

  const createDraft = useCallback(() => {
    return createNewDraft();
  }, [createNewDraft]);

  const loadExistingDraft = useCallback(
    (draftId: string) => {
      loadDraft(draftId);
    },
    [loadDraft],
  );

  const deleteDraftById = useCallback(
    (draftId: string) => {
      deleteDraft(draftId);
    },
    [deleteDraft],
  );

  const saveCurrentDraft = useCallback(() => {
    saveToDraft();
  }, [saveToDraft]);

  return {
    draftsList,
    draftCount,
    currentDraftId,
    createDraft,
    loadExistingDraft,
    deleteDraftById,
    saveCurrentDraft,
  };
};

/**
 * Hook for photo management functionality
 */
export const usePostPhotos = () => {
  const [selectedPhotos, setSelectedPhotos] = useAtom(selectedPhotosAtom);
  const canAddMorePhotos = useAtomValue(canAddMorePhotosAtom);
  const remainingPhotoSlots = useAtomValue(remainingPhotoSlotsAtom);

  const addPhotos = useSetAtom(addPhotosAtom);
  const removePhoto = useSetAtom(removePhotoAtom);
  const reorderPhotos = useSetAtom(reorderPhotosAtom);
  const autoSaveDraft = useSetAtom(autoSaveDraftAtom);

  const addPhotosWithValidation = useCallback(
    (newPhotos: SelectedPhoto[]) => {
      if (!canAddMorePhotos) {
        return { success: false, error: 'Maximum of 4 photos allowed per post' };
      }

      addPhotos(newPhotos);
      return { success: true };
    },
    [canAddMorePhotos, addPhotos],
  );

  const removePhotoByIndex = useCallback(
    (index: number) => {
      removePhoto(index);
      autoSaveDraft();
    },
    [removePhoto, autoSaveDraft],
  );

  const reorderPhotosList = useCallback(
    (reorderedPhotos: SelectedPhoto[]) => {
      reorderPhotos(reorderedPhotos);
      autoSaveDraft();
    },
    [reorderPhotos, autoSaveDraft],
  );

  return {
    selectedPhotos,
    canAddMorePhotos,
    remainingPhotoSlots,
    addPhotosWithValidation,
    removePhotoByIndex,
    reorderPhotosList,
    setSelectedPhotos,
  };
};

/**
 * Hook for validation and error handling
 */
export const usePostValidation = () => {
  const isFormValid = useAtomValue(isFormValidAtom);
  const characterCount = useAtomValue(contentCharacterCountAtom);
  const error = useAtomValue(postCreationErrorAtom);
  const setError = useSetAtom(postCreationErrorAtom);

  const clearError = useCallback(() => {
    setError(null);
  }, [setError]);

  const setErrorMessage = useCallback(
    (message: string) => {
      setError(message);
    },
    [setError],
  );

  const validateForm = useCallback(() => {
    const isValid = isFormValid;

    if (!isValid) {
      setError('Please fill in all required fields');
      return false;
    }

    if (!characterCount.isValid) {
      setError(`Content exceeds maximum length of ${characterCount.max} characters`);
      return false;
    }

    clearError();
    return true;
  }, [isFormValid, characterCount, setError, clearError]);

  return {
    isFormValid,
    characterCount,
    error,
    clearError,
    setErrorMessage,
    validateForm,
  };
};
