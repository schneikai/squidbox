import { Stack } from 'expo-router';

import SheetStack from '@/components/sheet-route/SheetStack';
import { PAGE_OVER_SHEET_OPTIONS } from '@/components/sheet-route/stackScreenOptions';

// The Send to channels sheet: a post's channel copies, then a copy as it goes out, its composer and the assistant chat
// it opens, pushed inside the sheet, and a photo of a copy's strip as a page over it.
export default function SendLayout() {
  return (
    <SheetStack>
      <Stack.Screen name="asset/[assetId]" options={PAGE_OVER_SHEET_OPTIONS} />
    </SheetStack>
  );
}
