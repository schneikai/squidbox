import { Stack } from 'expo-router';

import SheetStack from '@/components/sheet-route/SheetStack';

// The post editor's sheet: the editor, then the assistant chat it opens and the prompt buttons the
// chat opens, pushed inside the sheet.
export default function EditorLayout() {
  return (
    <SheetStack>
      <Stack.Screen name="prompt-buttons/[id]" dangerouslySingular />
    </SheetStack>
  );
}
