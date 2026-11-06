import { Stack } from 'expo-router';

import SheetStack from '@/components/sheet-route/SheetStack';

// Write with AI about a posted post: the chat, then the prompt buttons it opens, pushed inside the
// sheet. Opened from a post outside a sheet; inside one, the chat pushes inside that sheet instead.
export default function ChatLayout() {
  return (
    <SheetStack>
      <Stack.Screen name="prompt-buttons/[id]" dangerouslySingular />
    </SheetStack>
  );
}
