import { createNativeStackNavigator } from '@react-navigation/native-stack';

import AlbumNavigator from './AlbumNavigator';

import PostScreen from '@/screens/PostScreen';
import PostsScreen from '@/screens/PostsScreen';

const Stack = createNativeStackNavigator();

export default function PostNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="PostsScreen"
        component={PostsScreen}
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen name="PostScreen" component={PostScreen} />
      <Stack.Screen
        name="PostAlbumStack"
        component={AlbumNavigator}
        options={{
          headerShown: false,
        }}
      />
    </Stack.Navigator>
  );
}
