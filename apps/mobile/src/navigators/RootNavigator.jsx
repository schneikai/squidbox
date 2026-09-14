import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import ProgressOverlayHost from '@/components/progress-overlay/ProgressOverlayHost';
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

// Modal routes present as iOS pageSheets whose own top safe-area inset is 0. Without a
// SafeAreaProvider INSIDE the sheet, screens read the root provider's window inset (~notch/status-bar
// height) and render a large empty gap below the sheet's top edge. Wrapping each modal route in its
// own provider makes useSafeAreaInsets() measure the sheet's view. The full-screen copies of these
// screens on the root stack are unaffected — they keep using the root provider, which is correct there.
const asModalRoute = (Component) => {
  function ModalRoute(props) {
    return (
      <SafeAreaProvider>
        <Component {...props} />
        {/* This modal is a native sheet presented above the root, so the root's overlay host can't
            cover it. Render a host here too, inside the sheet, so a blocking/progress overlay
            triggered from within the modal covers the modal itself. */}
        <ProgressOverlayHost />
      </SafeAreaProvider>
    );
  }
  return ModalRoute;
};

const CreatePostModalRoute = asModalRoute(CreatePostNavigator);
const AddEditPostModalRoute = asModalRoute(AddEditPostNavigator);
const AssetPickerModalRoute = asModalRoute(AssetPickerScreen);
const AddToAlbumModalRoute = asModalRoute(AddToAlbumScreen);
const EditNotesModalRoute = asModalRoute(EditNotesModal);

export default function RootNavigator() {
  return (
    <RootStack.Navigator
      initialRouteName="MainTab"
      screenOptions={{ contentStyle: { backgroundColor: 'transparent' } }}
    >
      <RootStack.Group screenOptions={{ presentation: 'modal' }}>
        <RootStack.Screen name="CreatePostModal" component={CreatePostModalRoute} options={{ headerShown: false }} />
        <RootStack.Screen name="AddEditPostModal" component={AddEditPostModalRoute} options={{ headerShown: false }} />
        <RootStack.Screen name="AssetPickerModal" component={AssetPickerModalRoute} />
        <RootStack.Screen name="AddToAlbumModal" component={AddToAlbumModalRoute} options={{ headerShown: false }} />
        <RootStack.Screen name="EditNotesModal" component={EditNotesModalRoute} options={{ headerShown: false }} />
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
