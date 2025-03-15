import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AppStackParamList } from './types/navigation';
import Feed from '../../screens/Feed';
import NewPost from '../../screens/NewPost';
import Profile from '../../screens/Profile';
import SinglePost from '../../screens/SinglePost';
import Search from '../../screens/Search';
import SavedPosts from 'screens/SavedPosts';

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
      <Stack.Screen name="SinglePost" component={SinglePost} />
      <Stack.Screen name="Search" component={Search} />
      <Stack.Screen name="SavedPosts" component={SavedPosts} />
    </Stack.Navigator>
  );
}