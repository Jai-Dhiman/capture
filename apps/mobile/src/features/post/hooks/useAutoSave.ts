import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useRef, useState } from 'react';

export interface AutoSaveState {
  adjustmentValues: Record<string, number>;
  timestamp: number;
  imageUri: string;
}

export interface AutoSaveOptions {
  key: string;
  interval?: number; // Auto-save interval in milliseconds
  enabled?: boolean;
}

export interface AutoSaveActions {
  saveNow: () => Promise<void>;
  loadSaved: () => Promise<AutoSaveState | null>;
  clearSaved: () => Promise<void>;
  lastSaved: number | null;
  isSaving: boolean;
}

export function useAutoSave(
  data: Omit<AutoSaveState, 'timestamp'>,
  options: AutoSaveOptions,
): AutoSaveActions {
  const { key, interval = 5000, enabled = true } = options;
  const [lastSaved, setLastSaved] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastDataRef = useRef<string>('');

  const saveToStorage = useCallback(
    async (saveData: AutoSaveState) => {
      try {
        setIsSaving(true);
        await AsyncStorage.setItem(key, JSON.stringify(saveData));
        setLastSaved(Date.now());
      } catch (error) {
        console.error('Auto-save failed:', error);
      } finally {
        setIsSaving(false);
      }
    },
    [key],
  );

  const saveNow = useCallback(async () => {
    if (!enabled) return;

    const saveData: AutoSaveState = {
      ...data,
      timestamp: Date.now(),
    };

    await saveToStorage(saveData);
  }, [data, enabled, saveToStorage]);

  const loadSaved = useCallback(async (): Promise<AutoSaveState | null> => {
    try {
      const saved = await AsyncStorage.getItem(key);
      if (saved) {
        const parsed = JSON.parse(saved) as AutoSaveState;
        return parsed;
      }
    } catch (error) {
      console.error('Failed to load auto-saved data:', error);
    }
    return null;
  }, [key]);

  const clearSaved = useCallback(async () => {
    try {
      await AsyncStorage.removeItem(key);
      setLastSaved(null);
    } catch (error) {
      console.error('Failed to clear auto-saved data:', error);
    }
  }, [key]);

  // Auto-save effect
  useEffect(() => {
    if (!enabled) return;

    const currentDataString = JSON.stringify(data);

    // Only auto-save if data has changed
    if (currentDataString === lastDataRef.current) return;
    lastDataRef.current = currentDataString;

    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Set new timeout for auto-save
    timeoutRef.current = setTimeout(() => {
      saveNow();
    }, interval);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [data, enabled, interval, saveNow]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return {
    saveNow,
    loadSaved,
    clearSaved,
    lastSaved,
    isSaving,
  };
}
