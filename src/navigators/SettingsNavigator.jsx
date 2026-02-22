import { createNativeStackNavigator } from '@react-navigation/native-stack';

import AiPromptsScreen from '@/screens/AiPromptsScreen';
import SettingsScreen from '@/screens/SettingsScreen';

const Stack = createNativeStackNavigator();

export default function SettingsNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="SettingsScreen" component={SettingsScreen} options={{ title: 'Settings' }} />
      <Stack.Screen name="AiPromptsScreen" component={AiPromptsScreen} options={{ title: 'AI Prompts' }} />
    </Stack.Navigator>
  );
}
