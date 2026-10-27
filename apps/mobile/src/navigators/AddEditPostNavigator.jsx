import { createNativeStackNavigator } from '@react-navigation/native-stack';

import PostChatScreen from '@/features/post-chat/PostChatScreen';
import assistantScreens from '@/navigators/assistantScreens';
import AddPostScreen from '@/screens/AddPostScreen';
import EditPostScreen from '@/screens/EditPostScreen';

const Stack = createNativeStackNavigator();

// The post editor's sheet: the editor, then the assistant chat it opens and the setup screens the chat
// opens, pushed inside the sheet (a screen of the root stack would show behind it).
export default function AddEditPostNavigator({ route }) {
  const isEditMode = Boolean(route.params?.postId);
  const screenName = isEditMode ? 'EditPostScreen' : 'AddPostScreen';
  const screenComponent = isEditMode ? EditPostScreen : AddPostScreen;

  return (
    <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: 'transparent' } }}>
      <Stack.Screen name={screenName} component={screenComponent} initialParams={{ ...route.params }} />
      <Stack.Screen name="PostChatScreen" component={PostChatScreen} />
      {assistantScreens(Stack.Screen)}
    </Stack.Navigator>
  );
}
