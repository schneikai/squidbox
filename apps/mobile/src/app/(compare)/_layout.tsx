import { Stack } from 'expo-router';

import SheetStack from '@/components/sheet-route/SheetStack';
import { PAGE_OVER_SHEET_OPTIONS } from '@/components/sheet-route/stackScreenOptions';

// The blind model compare (Settings → Assistant → a model list → Compare): pick the models (and
// photos), then compare; a post a round shows pushes inside the sheet, a photo shows as a page over it.
export default function CompareLayout() {
  return (
    <SheetStack>
      <Stack.Screen name="post/[postId]" dangerouslySingular />
      <Stack.Screen name="asset/[assetId]" options={PAGE_OVER_SHEET_OPTIONS} />
    </SheetStack>
  );
}
