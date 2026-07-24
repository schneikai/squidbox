import { createNativeStackNavigator } from '@react-navigation/native-stack';

import AssetPickerScreen from '@/features/asset-picker/AssetPickerScreen';
import AddEditPostNavigator from '@/navigators/AddEditPostNavigator';
import CreatePostNavigator from '@/navigators/CreatePostNavigator';
import MainTabNavigator from '@/navigators/MainTabNavigator';
import AddToAlbumScreen from '@/screens/AddToAlbumScreen';
import AlbumScreen from '@/screens/AlbumScreen';
import AssetScreen from '@/screens/AssetScreen';
import EditNotesModal from '@/screens/EditNotesModal';
import PostScreen from '@/screens/PostScreen';

const RootStack = createNativeStackNavigator();

export default function RootNavigator() {
  return (
    <RootStack.Navigator
      initialRouteName="MainTab"
      screenOptions={{ contentStyle: { backgroundColor: 'transparent' } }}
    >
      <RootStack.Group screenOptions={{ presentation: 'modal' }}>
        <RootStack.Screen
          name="CreatePostModal"
          component={CreatePostNavigator}
          options={{ headerShown: false }}
        />
        <RootStack.Screen name="AddEditPostModal" component={AddEditPostNavigator} options={{ headerShown: false }} />
        <RootStack.Screen name="AssetPickerModal" component={AssetPickerScreen} />
        <RootStack.Screen name="AddToAlbumModal" component={AddToAlbumScreen} options={{ headerShown: false }} />
        <RootStack.Screen name="EditNotesModal" component={EditNotesModal} options={{ headerShown: false }} />
      </RootStack.Group>
      <RootStack.Group screenOptions={{ headerShown: false }}>
        <RootStack.Screen name="MainTab" component={MainTabNavigator} />
        <RootStack.Screen name="AlbumScreen" component={AlbumScreen} />
        <RootStack.Screen name="PostScreen" component={PostScreen} />
        <RootStack.Screen name="AssetScreen" component={AssetScreen} />
      </RootStack.Group>
    </RootStack.Navigator>
  );
}
