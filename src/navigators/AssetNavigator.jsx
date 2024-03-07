import { createNativeStackNavigator } from '@react-navigation/native-stack';

import useTabBarVisibility from '@/hooks/useTabBarVisibility';
import AssetScreen from '@/screens/AssetScreen';
import AssetsScreen from '@/screens/AssetsScreen';

const Stack = createNativeStackNavigator();

const DETAIL_SCREEN_NAME = 'AssetScreen';

export default function AssetNavigator({ route, navigation }) {
  // Hide tab bar on detail screen
  useTabBarVisibility(navigation, route, DETAIL_SCREEN_NAME);

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="AssetsScreen" component={AssetsScreen} />
      <Stack.Screen name={DETAIL_SCREEN_NAME} component={AssetScreen} />
    </Stack.Navigator>
  );
}
