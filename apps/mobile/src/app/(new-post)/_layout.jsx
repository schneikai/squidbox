import { Stack } from 'expo-router';

import SheetStack from '@/components/sheet-route/SheetStack';

// The New post sheet: what to post next, then the posts, assets and albums it opens, pushed inside
// the sheet.
// A deep link to a screen inside the sheet opens it over the sheet's first screen.
export const unstable_settings = { anchor: 'new-post/index' };

export default function NewPostLayout() {
  return (
    <SheetStack>
      <Stack.Screen name="post/[postId]" dangerouslySingular />
      <Stack.Screen name="prompt-buttons/[id]" dangerouslySingular />
    </SheetStack>
  );
}
