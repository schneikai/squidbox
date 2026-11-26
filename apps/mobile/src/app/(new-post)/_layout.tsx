import { Stack } from 'expo-router';

import SheetStack from '@/components/sheet-route/SheetStack';
import { PAGE_OVER_SHEET_OPTIONS } from '@/components/sheet-route/stackScreenOptions';

// The New post sheet: what to post next, then the posts and albums it opens, pushed inside the
// sheet, and a photo as a page over it.
// A deep link to a screen inside the sheet opens it over the sheet's first screen.
export const unstable_settings = { anchor: 'new-post/index' };

export default function NewPostLayout() {
  return (
    <SheetStack>
      <Stack.Screen name="post/[postId]" dangerouslySingular />
      <Stack.Screen name="asset/[assetId]" options={PAGE_OVER_SHEET_OPTIONS} />
    </SheetStack>
  );
}
