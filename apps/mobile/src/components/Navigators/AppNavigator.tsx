import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AppStackParamList } from './types/navigation';
import Feed from '../../screens/Feed';
import NewPost from '../../screens/NewPost';
import Profile from '../../screens/Profile';
import Search from '../../screens/Search';
import SettingsNavigator from './SettingsNavigator';
import ImageEditScreen from '../../screens/ImageEditScreen';

const Stack = createNativeStackNavigator<AppStackParamList>();

export default function AppNavigator() {
  return (
    <Stack.Navigator
      initialRouteName="Feed"
      screenOptions={{
        headerShown: false
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
          presentation: 'modal'
        }}
      />
    </Stack.Navigator>
  );
}

