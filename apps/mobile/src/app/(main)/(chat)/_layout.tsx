import { Stack } from 'expo-router';

import SheetStack from '@/components/sheet-route/SheetStack';

// The assistant's chat about a post (Chat on its tray), then the prompt buttons it opens, pushed
// inside the sheet. Opened from a post outside a sheet; inside one, the chat pushes inside that sheet.
export default function ChatLayout() {
  return (
    <SheetStack>
      <Stack.Screen name="prompt-buttons/[id]" dangerouslySingular />
    </SheetStack>
  );
}
