import { createNativeStackNavigator } from '@react-navigation/native-stack';
import Feed from '../../screens/Feed';
import NewPost from '../../screens/NewPost';
import Profile from '../../screens/Profile';
import SinglePost from '../../screens/SinglePost';
import UserSearch from '../../screens/UserSearch';
import { AppStackParamList } from '../../types/navigation';

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
      <Stack.Screen name="UserSearch" component={UserSearch} />
    </Stack.Navigator>
  );
}