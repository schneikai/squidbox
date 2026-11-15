import { useRouter } from 'expo-router';
import { useState } from 'react';

import MentionContactSheet from './MentionContactSheet';
import type { MentionContact } from './mentionHandle';

import useSheetRoute from '@/hooks/useSheetRoute';

/**
 * The sheet a tapped mention chip opens (MentionContactSheet), one per screen: `onPressMention(id)`
 * for the chips, `sheet` to render once. Its Open contact shows only outside a sheet
 * (ContactChipsSection's rule): a contact's page is never pushed over a draft.
 */
export default function useMentionSheet(contactsById: ReadonlyMap<string, MentionContact>) {
  const router = useRouter();
  const isInSheet = !!useSheetRoute();
  const [contactId, setContactId] = useState<string | null>(null);

  function openContact(id: string) {
    setContactId(null);
    router.navigate(`/contact/${id}`);
  }

  const sheet = (
    <MentionContactSheet
      contact={contactId ? (contactsById.get(contactId) ?? null) : null}
      onClose={() => setContactId(null)}
      onOpenContact={isInSheet ? undefined : openContact}
    />
  );
  return { onPressMention: setContactId, sheet };
}
