import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { MenuProvider } from 'react-native-popup-menu';

import AlbumScreen from '@/screens/AlbumScreen';
import AssetScreen from '@/screens/AssetScreen';
import PostScreen from '@/screens/PostScreen';

const Stack = createNativeStackNavigator();

/**
 * The stack inside a modal sheet: its own screens (`children`, as `ModalStackNavigator.Screen`s), then
 * the asset, post and album screens they open. Those are registered here as well as on the root
 * stack because a screen opened on the root stack would show behind the sheet. The sheet has its own
 * MenuProvider, as the root one's menus would show behind it too.
 */
export default function ModalStackNavigator({ children }) {
  return (
    <MenuProvider skipInstanceCheck>
      <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: 'transparent' } }}>
        {children}
        <Stack.Screen name="AssetScreen" component={AssetScreen} />
        <Stack.Screen name="PostScreen" component={PostScreen} />
        <Stack.Screen name="AlbumScreen" component={AlbumScreen} />
      </Stack.Navigator>
    </MenuProvider>
  );
}

ModalStackNavigator.Screen = Stack.Screen;
