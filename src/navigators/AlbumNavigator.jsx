import { createNativeStackNavigator } from '@react-navigation/native-stack';

import AlbumScreen from '@/screens/AlbumScreen';
import AlbumsScreen from '@/screens/AlbumsScreen';
import AssetScreen from '@/screens/AssetScreen';
import PostScreen from '@/screens/PostScreen';

const Stack = createNativeStackNavigator();

export default function AlbumNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{ headerShown: false, contentStyle: { backgroundColor: 'transparent' } }}
    >
      <Stack.Screen name="AlbumsScreen" component={AlbumsScreen} />
      <Stack.Screen name="AlbumScreen" component={AlbumScreen} />
      <Stack.Screen name="AssetScreen" component={AssetScreen} />
      <Stack.Screen name="PostScreen" component={PostScreen} />
    </Stack.Navigator>
  );
}
