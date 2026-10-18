import { createNativeStackNavigator } from '@react-navigation/native-stack';

import AddPostScreen from '@/screens/AddPostScreen';
import EditPostScreen from '@/screens/EditPostScreen';

const Stack = createNativeStackNavigator();

export default function AddEditPostNavigator({ route }) {
  const isEditMode = Boolean(route.params?.postId);
  const screenName = isEditMode ? 'EditPostScreen' : 'AddPostScreen';
  const screenComponent = isEditMode ? EditPostScreen : AddPostScreen;

  return (
    <Stack.Navigator>
      <Stack.Screen
        name={screenName}
        component={screenComponent}
        options={{ headerShown: false }}
        initialParams={{ ...route.params }}
      />
    </Stack.Navigator>
  );
}
