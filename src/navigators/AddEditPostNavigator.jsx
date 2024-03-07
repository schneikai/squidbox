import { createNativeStackNavigator } from '@react-navigation/native-stack';

import AssetPickerScreen from '@/features/asset-picker/AssetPickerScreen';
import AddPostScreen from '@/screens/AddPostScreen';
import EditPostScreen from '@/screens/EditPostScreen';

const Stack = createNativeStackNavigator();

export default function AddEditPostNavigator({ route }) {
  const isEditMode = Boolean(route.params?.postId);
  const screenName = isEditMode ? 'EditPostScreen' : 'AddPostScreen';
  const screenComponent = isEditMode ? EditPostScreen : AddPostScreen;
  const sreenTitle = isEditMode ? 'Edit Post' : 'Add Post';

  return (
    <Stack.Navigator>
      <Stack.Screen
        name={screenName}
        component={screenComponent}
        options={{
          title: sreenTitle,
        }}
        initialParams={{ ...route.params }}
      />
      {/* 
        We have to repeat the AssetPicker screen from the RootNavigator here because we are 
        inside a modal and we cannot open another modal on top of a it.
      */}
      <Stack.Screen name="AssetPicker" component={AssetPickerScreen} />
    </Stack.Navigator>
  );
}
