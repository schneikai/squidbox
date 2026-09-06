import { createNativeStackNavigator } from '@react-navigation/native-stack';

import AssetsScreen from '@/screens/AssetsScreen';

const Stack = createNativeStackNavigator();

export default function AssetNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: 'transparent' } }}>
      <Stack.Screen name="AssetsScreen" component={AssetsScreen} />
    </Stack.Navigator>
  );
}
