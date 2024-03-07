import { createNativeStackNavigator } from '@react-navigation/native-stack';

import AlbumScreen from '@/features/asset-picker/AlbumScreen';
import AlbumsScreen from '@/features/asset-picker/AlbumsScreen';
import AssetsScreen from '@/features/asset-picker/AssetsScreen.jsx';

const StackNavigator = createNativeStackNavigator();
const AlbumsStackNavigator = createNativeStackNavigator();

export default function AssetPickerStackNavigator() {
  return (
    <StackNavigator.Navigator screenOptions={{ headerShown: false }}>
      <StackNavigator.Screen name="Assets" component={AssetsScreen} />
      <AlbumsStackNavigator.Screen name="Albums" component={AlbumsScreen} />
      <AlbumsStackNavigator.Screen name="Album" component={AlbumScreen} />
    </StackNavigator.Navigator>
  );
}
