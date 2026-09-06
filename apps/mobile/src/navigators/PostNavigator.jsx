import { createNativeStackNavigator } from '@react-navigation/native-stack';

import PostsScreen from '@/screens/PostsScreen';

const Stack = createNativeStackNavigator();

export default function PostNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: 'transparent' } }}>
      <Stack.Screen name="PostsScreen" component={PostsScreen} />
    </Stack.Navigator>
  );
}
