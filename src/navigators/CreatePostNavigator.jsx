import { createNativeStackNavigator } from '@react-navigation/native-stack';

import PostScreen from '@/screens/PostScreen';
import CreatePostScreen from '@/screens/CreatePostScreen';
import IgnoredPostsScreen from '@/screens/IgnoredPostsScreen';
import AlbumScreen from '@/screens/AlbumScreen';
import { MenuProvider } from 'react-native-popup-menu';
import { HeaderBackButton } from '@react-navigation/elements';
const Stack = createNativeStackNavigator();

export default function CreatePostNavigator() {
  return (
    <MenuProvider skipInstanceCheck>
      <Stack.Navigator>
        <Stack.Screen
          name="CreatePostScreen"
          component={CreatePostScreen}
          options={({ navigation }) => ({
            title: "Create Post",
            headerLeft: () => (
              <HeaderBackButton
                onPress={() => navigation.goBack()}
              />
            ),
          })}
      />
      <Stack.Screen name="PostScreen" component={PostScreen} />
      <Stack.Screen name="IgnoredPostsScreen" component={IgnoredPostsScreen} options={{ title: 'Ignored Posts' }} />
      <Stack.Screen name="AlbumScreen" component={AlbumScreen} options={{ headerShown: false }} />
      </Stack.Navigator>
    </MenuProvider>
  );
}
