import { createNativeStackNavigator } from '@react-navigation/native-stack';

import FeaturesScreen from '@/features/account-features/FeaturesScreen';
import AssistantScreen from '@/features/assistant/AssistantScreen';
import ModelListScreen from '@/features/model-compare/ModelListScreen';
import ModelScreen from '@/features/model-verify/ModelScreen';
import VerifyConversationScreen from '@/features/model-verify/VerifyConversationScreen';
import VerifyScreen from '@/features/model-verify/VerifyScreen';
import BackupScreen from '@/screens/BackupScreen';
import SettingsScreen from '@/screens/SettingsScreen';
import SyncScreen from '@/screens/SyncScreen';

const Stack = createNativeStackNavigator();

// One model page and one Verify page per model and kind, one conversation page per section of it.
const modelId = ({ params }) => `${params?.kind}:${params?.modelId}`;
const conversationId = ({ params }) => `${params?.kind}:${params?.modelId}:${params?.sectionId}`;

export default function SettingsNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: 'transparent' } }}>
      <Stack.Screen name="SettingsScreen" component={SettingsScreen} />
      <Stack.Screen name="BackupScreen" component={BackupScreen} />
      <Stack.Screen name="SyncScreen" component={SyncScreen} />
      <Stack.Screen name="AssistantScreen" component={AssistantScreen} />
      <Stack.Screen name="ModelListScreen" component={ModelListScreen} />
      <Stack.Screen name="ModelScreen" component={ModelScreen} getId={modelId} />
      <Stack.Screen name="VerifyScreen" component={VerifyScreen} getId={modelId} />
      <Stack.Screen name="VerifyConversationScreen" component={VerifyConversationScreen} getId={conversationId} />
      <Stack.Screen name="FeaturesScreen" component={FeaturesScreen} />
    </Stack.Navigator>
  );
}
