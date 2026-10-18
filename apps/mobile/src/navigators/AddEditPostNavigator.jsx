import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { MenuProvider } from 'react-native-popup-menu';

import AddPostScreen from '@/screens/AddPostScreen';
import AlbumScreen from '@/screens/AlbumScreen';
import AssetScreen from '@/screens/AssetScreen';
import EditPostScreen from '@/screens/EditPostScreen';
import PostScreen from '@/screens/PostScreen';

const Stack = createNativeStackNavigator();

export default function AddEditPostNavigator({ route }) {
  const isEditMode = Boolean(route.params?.postId);
  const screenName = isEditMode ? 'EditPostScreen' : 'AddPostScreen';
  const screenComponent = isEditMode ? EditPostScreen : AddPostScreen;

  return (
    <MenuProvider skipInstanceCheck>
      <Stack.Navigator>
        <Stack.Screen
          name={screenName}
          component={screenComponent}
          options={{ headerShown: false }}
          initialParams={{ ...route.params }}
        />
        {/* As in CreatePostNavigator: the suggestions' asset, and an album or a post its details open,
            would otherwise open on the root stack, behind this sheet. */}
        <Stack.Group screenOptions={{ headerShown: false, contentStyle: { backgroundColor: 'transparent' } }}>
          <Stack.Screen name="AssetScreen" component={AssetScreen} />
          <Stack.Screen name="PostScreen" component={PostScreen} />
          <Stack.Screen name="AlbumScreen" component={AlbumScreen} />
        </Stack.Group>
      </Stack.Navigator>
    </MenuProvider>
  );
}
