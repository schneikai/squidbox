import { createNativeStackNavigator } from '@react-navigation/native-stack';

import AlbumScreen from '@/screens/AlbumScreen';
import AssetScreen from '@/screens/AssetScreen';
import OtherPostsScreen from '@/screens/OtherPostsScreen';
import PostScreen from '@/screens/PostScreen';

const Stack = createNativeStackNavigator();

/**
 * The stack inside a modal sheet: its own screens (`children`, as `ModalStackNavigator.Screen`s), then
 * the asset, post, other-posts and album screens they open. Those are registered here as well as on the root
 * stack because a screen opened on the root stack would show behind the sheet.
 */
export default function ModalStackNavigator({ children }) {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: 'transparent' } }}>
      {children}
      <Stack.Screen name="AssetScreen" component={AssetScreen} />
      <Stack.Screen name="PostScreen" component={PostScreen} getId={({ params }) => params?.postId} />
      <Stack.Screen name="OtherPostsScreen" component={OtherPostsScreen} />
      <Stack.Screen name="AlbumScreen" component={AlbumScreen} />
    </Stack.Navigator>
  );
}

ModalStackNavigator.Screen = Stack.Screen;
