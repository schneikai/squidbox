import { createNativeStackNavigator } from "@react-navigation/native-stack";

import PostIndexScreen from "screens/PostIndexScreen";
import PostDetailScreen from "screens/PostDetailScreen";

const StackNavigator = createNativeStackNavigator();

export default function PostStackNavigator() {
  return (
    <StackNavigator.Navigator>
      <StackNavigator.Screen name="PostIndex" component={PostIndexScreen} options={{ title: "Posts" }} />
      <StackNavigator.Screen name="PostDetail" component={PostDetailScreen} options={{ title: "Post" }} />
    </StackNavigator.Navigator>
  );
}
