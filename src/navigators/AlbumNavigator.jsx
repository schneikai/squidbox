import { createNativeStackNavigator } from '@react-navigation/native-stack';

import useTabBarVisibility from '@/hooks/useTabBarVisibility';
import AlbumScreen from '@/screens/AlbumScreen';
import AlbumsScreen from '@/screens/AlbumsScreen';
import AssetScreen from '@/screens/AssetScreen';

const Stack = createNativeStackNavigator();

const DETAIL_SCREEN_NAME = 'AlbumScreen';

export default function AlbumNavigator({ route, navigation }) {
  // Hide tab bar on detail screen
  useTabBarVisibility(navigation, route, DETAIL_SCREEN_NAME);

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="AlbumsScreen" component={AlbumsScreen} />
      <Stack.Screen name={DETAIL_SCREEN_NAME} component={AlbumScreen} />
      <Stack.Screen name="AlbumAssetScreen" component={AssetScreen} />
    </Stack.Navigator>
  );
}
