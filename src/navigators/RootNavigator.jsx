import { createNativeStackNavigator } from '@react-navigation/native-stack';

import AssetPickerScreen from '@/features/asset-picker/AssetPickerScreen';
import AddEditPostNavigator from '@/navigators/AddEditPostNavigator';
import MainTabNavigator from '@/navigators/MainTabNavigator';
import AddToAlbumScreen from '@/screens/AddToAlbumScreen';
const RootStack = createNativeStackNavigator();

export default function RootNavigator() {
  return (
    <RootStack.Navigator initialRouteName="MainTab">
      <RootStack.Group screenOptions={{ presentation: 'modal' }}>
        <RootStack.Screen name="AddEditPostModal" component={AddEditPostNavigator} options={{ headerShown: false }} />
        <RootStack.Screen name="AssetPickerModal" component={AssetPickerScreen} />
        <RootStack.Screen name="AddToAlbumModal" component={AddToAlbumScreen} />
      </RootStack.Group>
      <RootStack.Group>
        <RootStack.Screen name="MainTab" component={MainTabNavigator} options={{ headerShown: false }} />
      </RootStack.Group>
    </RootStack.Navigator>
  );
}
