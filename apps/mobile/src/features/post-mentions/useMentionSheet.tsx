import { useRouter } from 'expo-router';
import { useState } from 'react';

import MentionContactSheet from './MentionContactSheet';
import type { MentionContact } from './mentionHandle';

import useSheetRoute from '@/hooks/useSheetRoute';

type MentionSheetOptions = {
  /**
   * In a sheet that is no draft (Send to channels, which saves every change as it is made): Open
   * contact closes the sheet and opens the contact's page under it.
   */
  closesSheetForContact?: boolean;
};

/**
 * The sheet a tapped mention chip opens (MentionContactSheet), one per screen: `onPressMention(id)`
 * for the chips, `sheet` to render once. Its Open contact shows outside a sheet, and in one that
 * `closesSheetForContact`: a contact's page is never pushed over a draft (ContactChipsSection's rule).
 */
export default function useMentionSheet(
  contactsById: ReadonlyMap<string, MentionContact>,
  { closesSheetForContact = false }: MentionSheetOptions = {},
) {
  const router = useRouter();
  const sheetRoute = useSheetRoute();
  const [contactId, setContactId] = useState<string | null>(null);

  function openContact(id: string) {
    setContactId(null);
    sheetRoute?.close();
    router.navigate(`/contact/${id}`);
  }

  const sheet = (
    <MentionContactSheet
      contact={contactId ? (contactsById.get(contactId) ?? null) : null}
      onClose={() => setContactId(null)}
      onOpenContact={!sheetRoute || closesSheetForContact ? openContact : undefined}
    />
  );
  return { onPressMention: setContactId, sheet };
}
