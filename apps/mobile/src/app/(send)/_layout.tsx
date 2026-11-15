import { Stack } from 'expo-router';

import SheetStack from '@/components/sheet-route/SheetStack';

// The Send to channels sheet: a post's channel copies, then a copy as it goes out, its composer and the assistant chat
// and prompt buttons it opens, pushed inside the sheet.
export default function SendLayout() {
  return (
    <SheetStack>
      <Stack.Screen name="prompt-buttons/[id]" dangerouslySingular />
    </SheetStack>
  );
}
