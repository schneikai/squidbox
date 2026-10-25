import { createNativeStackNavigator } from '@react-navigation/native-stack';

import AssistantScreen from '@/features/model-compare/AssistantScreen';
import ModelListScreen from '@/features/model-compare/ModelListScreen';
import BackupScreen from '@/screens/BackupScreen';
import SettingsScreen from '@/screens/SettingsScreen';
import SyncScreen from '@/screens/SyncScreen';

const Stack = createNativeStackNavigator();

export default function SettingsNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: 'transparent' } }}>
      <Stack.Screen name="SettingsScreen" component={SettingsScreen} />
      <Stack.Screen name="BackupScreen" component={BackupScreen} />
      <Stack.Screen name="SyncScreen" component={SyncScreen} />
      <Stack.Screen name="AssistantScreen" component={AssistantScreen} />
      <Stack.Screen name="ModelListScreen" component={ModelListScreen} />
    </Stack.Navigator>
  );
}
