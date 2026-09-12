import { createNativeStackNavigator } from '@react-navigation/native-stack';

import AiPromptsScreen from '@/screens/AiPromptsScreen';
import BackupScreen from '@/screens/BackupScreen';
import SettingsScreen from '@/screens/SettingsScreen';
import SyncScreen from '@/screens/SyncScreen';

const Stack = createNativeStackNavigator();

export default function SettingsNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: 'transparent' } }}>
      <Stack.Screen name="SettingsScreen" component={SettingsScreen} />
      <Stack.Screen name="AiPromptsScreen" component={AiPromptsScreen} />
      <Stack.Screen name="BackupScreen" component={BackupScreen} />
      <Stack.Screen name="SyncScreen" component={SyncScreen} />
    </Stack.Navigator>
  );
}
