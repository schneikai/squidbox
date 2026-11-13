import { Stack } from 'expo-router';

import SheetStack from '@/components/sheet-route/SheetStack';
import PostDraftProvider from '@/features/posts/draft/PostDraftProvider';

// The post editor's sheet: the editor, a channel's step, then the assistant chat it opens and the
// prompt buttons the chat opens, pushed inside the sheet. The editor and its channels' steps share
// one draft.
export default function EditorLayout() {
  return (
    <PostDraftProvider>
      <SheetStack>
        <Stack.Screen name="prompt-buttons/[id]" dangerouslySingular />
      </SheetStack>
    </PostDraftProvider>
  );
}
