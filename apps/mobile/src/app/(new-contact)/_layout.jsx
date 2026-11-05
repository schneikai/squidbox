import SheetStack from '@/components/sheet-route/SheetStack';
import NewContactDraftProvider from '@/features/contact-new/NewContactDraftProvider';

// The New contact sheet: the form, and its Lists step pushed inside the sheet, sharing one draft.
export const unstable_settings = { anchor: 'new-contact/index' };

export default function NewContactLayout() {
  return (
    <NewContactDraftProvider>
      <SheetStack />
    </NewContactDraftProvider>
  );
}
