import AsyncStorage from '@react-native-async-storage/async-storage';
import { atomWithStorage, createJSONStorage } from 'jotai/utils';

export type ThemeOption = 'light' | 'dark' | 'system';

const storage = createJSONStorage<ThemeOption>(() => AsyncStorage);

export const themeAtom = atomWithStorage<ThemeOption>('app-theme', 'light', storage);
