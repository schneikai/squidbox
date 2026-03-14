import { createNativeStackNavigator } from '@react-navigation/native-stack';

import AiPromptsScreen from '@/screens/AiPromptsScreen';
import SettingsScreen from '@/screens/SettingsScreen';

const Stack = createNativeStackNavigator();

export default function SettingsNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: 'transparent' } }}>
      <Stack.Screen name="SettingsScreen" component={SettingsScreen} />
      <Stack.Screen name="AiPromptsScreen" component={AiPromptsScreen} />
    </Stack.Navigator>
  );
}
