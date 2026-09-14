import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { MenuProvider } from 'react-native-popup-menu';

import AlbumScreen from '@/screens/AlbumScreen';
import AssetScreen from '@/screens/AssetScreen';
import CreatePostScreen from '@/screens/CreatePostScreen';
import IgnoredPostsScreen from '@/screens/IgnoredPostsScreen';
import PostScreen from '@/screens/PostScreen';

const Stack = createNativeStackNavigator();

export default function CreatePostNavigator() {
  return (
    <MenuProvider skipInstanceCheck>
      <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: 'transparent' } }}>
        <Stack.Screen name="CreatePostScreen" component={CreatePostScreen} />
        <Stack.Screen name="PostScreen" component={PostScreen} />
        <Stack.Screen name="IgnoredPostsScreen" component={IgnoredPostsScreen} />
        <Stack.Screen name="AlbumScreen" component={AlbumScreen} />
        {/* Registered here (as well as on the root stack) because we're inside a modal: navigating
            to a root-only screen would resolve on the stack BEHIND the modal and open there. Same
            reason AddEditPostNavigator re-registers AssetPicker. */}
        <Stack.Screen name="AssetScreen" component={AssetScreen} />
      </Stack.Navigator>
    </MenuProvider>
  );
}
