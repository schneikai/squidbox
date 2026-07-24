import { createNativeStackNavigator } from '@react-navigation/native-stack';

import AlbumsScreen from '@/screens/AlbumsScreen';

const Stack = createNativeStackNavigator();

export default function AlbumNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{ headerShown: false, contentStyle: { backgroundColor: 'transparent' } }}
    >
      <Stack.Screen name="AlbumsScreen" component={AlbumsScreen} />
    </Stack.Navigator>
  );
}
