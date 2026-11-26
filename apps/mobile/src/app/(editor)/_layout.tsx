import { Stack } from 'expo-router';

import SheetStack from '@/components/sheet-route/SheetStack';
import { PAGE_OVER_SHEET_OPTIONS } from '@/components/sheet-route/stackScreenOptions';

// The post editor's sheet: the editor, then the assistant chat it opens, pushed inside the sheet,
// and a photo of its strip as a page over it.
export default function EditorLayout() {
  return (
    <SheetStack>
      <Stack.Screen name="asset/[assetId]" options={PAGE_OVER_SHEET_OPTIONS} />
    </SheetStack>
  );
}
