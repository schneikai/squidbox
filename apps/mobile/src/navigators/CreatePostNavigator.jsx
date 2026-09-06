import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { MenuProvider } from 'react-native-popup-menu';

import AlbumScreen from '@/screens/AlbumScreen';
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
      </Stack.Navigator>
    </MenuProvider>
  );
}
