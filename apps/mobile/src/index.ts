console.log('[INDEX] Starting imports...');
import 'react-native-reanimated';
console.log('[INDEX] Reanimated imported');
import 'react-native-gesture-handler';
console.log('[INDEX] Gesture handler imported');
import { registerRootComponent } from 'expo';
console.log('[INDEX] Expo imported');
import App from './App';
console.log('[INDEX] App imported');

registerRootComponent(App);
