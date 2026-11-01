import { Stack } from 'expo-router';

import SheetStack from '@/components/sheet-route/SheetStack';

// The blind model compare (Settings → Assistant → a model list → Compare): pick the models (and
// photos), then compare; the assets a round shows push inside the sheet.
export default function CompareLayout() {
  return (
    <SheetStack>
      <Stack.Screen name="post/[postId]" dangerouslySingular />
      <Stack.Screen name="prompt-buttons/[id]" dangerouslySingular />
    </SheetStack>
  );
}
