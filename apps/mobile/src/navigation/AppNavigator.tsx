import Feed from '@/features/feed/screens/Feed';
import ImageEditScreen from '@/features/post/screens/ImageEditScreen';
import NewPost from '@/features/post/screens/NewPost';
import PhotoSelectionScreen from '@/features/post/screens/PhotoSelectionScreen';
import Profile from '@/features/profile/screens/Profile';
import Search from '@/features/search/screens/Search';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import SettingsNavigator from './SettingsNavigator';
import type { AppStackParamList } from './types';

const Stack = createNativeStackNavigator<AppStackParamList>();

export default function AppNavigator() {
  return (
    <Stack.Navigator
      initialRouteName="Feed"
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="Feed" component={Feed} />
      <Stack.Screen name="NewPost" component={NewPost} />
      <Stack.Screen name="Profile" component={Profile} />
      <Stack.Screen name="Search" component={Search} />
      <Stack.Screen name="Settings" component={SettingsNavigator} />
      <Stack.Screen
        name="ImageEditScreen"
        component={ImageEditScreen}
        options={{
          headerShown: false,
          presentation: 'modal',
        }}
      />
      <Stack.Screen
        name="PhotoSelectionScreen"
        component={PhotoSelectionScreen}
        options={{
          headerShown: false,
          presentation: 'fullScreenModal',
        }}
      />
    </Stack.Navigator>
  );
}
