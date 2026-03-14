import { createNativeStackNavigator } from '@react-navigation/native-stack';

import AlbumScreen from '@/screens/AlbumScreen';
import PostScreen from '@/screens/PostScreen';
import PostsScreen from '@/screens/PostsScreen';

const Stack = createNativeStackNavigator();

export default function PostNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: 'transparent' } }}>
      <Stack.Screen name="PostsScreen" component={PostsScreen} />
      <Stack.Screen name="PostScreen" component={PostScreen} />
      <Stack.Screen name="AlbumScreen" component={AlbumScreen} />
    </Stack.Navigator>
  );
}
