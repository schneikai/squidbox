import { createNativeStackNavigator } from '@react-navigation/native-stack';

import PostChatNavigator from '@/navigators/PostChatNavigator';
import AlbumNotesScreen from '@/screens/AlbumNotesScreen';
import AlbumScreen from '@/screens/AlbumScreen';
import AssetScreen from '@/screens/AssetScreen';
import PostScreen from '@/screens/PostScreen';

const Stack = createNativeStackNavigator();

/**
 * The stack inside a modal sheet: its own screens (`children`, as `ModalStackNavigator.Screen`s), then
 * the asset, post and album screens they open, an album's notes and a post's assistant chat. Those are registered here as
 * well as on the root stack because a screen opened on the root stack would show behind the sheet
 * (the notes, a sheet on the root stack, push inside this one with Back: never a second sheet).
 */
export default function ModalStackNavigator({ children }) {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: 'transparent' } }}>
      {children}
      <Stack.Screen name="AssetScreen" component={AssetScreen} />
      <Stack.Screen name="PostScreen" component={PostScreen} getId={({ params }) => params?.postId} />
      <Stack.Screen name="AlbumScreen" component={AlbumScreen} />
      <Stack.Screen name="AlbumNotesScreen" component={AlbumNotesScreen} />
      <Stack.Screen name="PostChat" component={PostChatNavigator} />
    </Stack.Navigator>
  );
}

ModalStackNavigator.Screen = Stack.Screen;
