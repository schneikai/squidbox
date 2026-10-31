import { createNativeStackNavigator } from '@react-navigation/native-stack';

import PostChatScreen from '@/features/post-chat/PostChatScreen';
import assistantScreens from '@/navigators/assistantScreens';

const Stack = createNativeStackNavigator();

// The assistant chat about a post outside the editor (a posted post's "Write with AI"), then the
// setup screens it opens, pushed inside it: a sheet on the root stack, pushed inside another sheet.
// Params go to the chat (PostChatScreen).
export default function PostChatNavigator({ route }) {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: 'transparent' } }}>
      <Stack.Screen name="PostChatScreen" component={PostChatScreen} initialParams={route.params} />
      {assistantScreens(Stack.Screen)}
    </Stack.Navigator>
  );
}
