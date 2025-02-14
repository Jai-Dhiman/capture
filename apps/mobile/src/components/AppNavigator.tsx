import { createNativeStackNavigator } from '@react-navigation/native-stack';
import Feed from '../screens/Feed';
import NewPost from '../screens/NewPost';
import { AppStackParamList } from '../types/navigation';

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
    </Stack.Navigator>
  );
}