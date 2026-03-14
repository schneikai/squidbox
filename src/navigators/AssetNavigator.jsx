import { createNativeStackNavigator } from '@react-navigation/native-stack';


import AssetScreen from '@/screens/AssetScreen';
import AssetsScreen from '@/screens/AssetsScreen';

const Stack = createNativeStackNavigator();

export default function AssetNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: 'transparent' } }}>
      <Stack.Screen name="AssetsScreen" component={AssetsScreen} />
      <Stack.Screen name="AssetScreen" component={AssetScreen} />
    </Stack.Navigator>
  );
}
