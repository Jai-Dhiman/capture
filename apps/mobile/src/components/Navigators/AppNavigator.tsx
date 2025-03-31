import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AppStackParamList } from './types/navigation';
import Feed from '../../screens/Feed';
import NewPost from '../../screens/NewPost';
import Profile from '../../screens/Profile';
import Search from '../../screens/Search';
import SavedPosts from '../../screens/SavedPosts';
import MainSettingsScreen from '../../screens/settings/MainSettingsScreen';
import AccountSettingsScreen from '../../screens/settings/AccountSettingsScreen';

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
      <Stack.Screen name="SavedPosts" component={SavedPosts} />
      <Stack.Screen name="MainSettings" component={MainSettingsScreen} />
      <Stack.Screen name="AccountSettings" component={AccountSettingsScreen} />
    </Stack.Navigator>
  );
}

