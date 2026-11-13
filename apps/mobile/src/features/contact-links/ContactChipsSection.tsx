import { router } from 'expo-router';

import Chip from '@/components/Chip';
import ChipRow from '@/components/ChipRow';
import ScreenSectionHeader from '@/components/ScreenSectionHeader';
import ContactAvatar from '@/features/contact-avatar/ContactAvatar';
import useContactRows from '@/features/contact-list/useContactRows';
import useSheetRoute from '@/hooks/useSheetRoute';
import unguarded, { type GuardPress } from '@/lib/unguarded';
import type { ContactScope } from '@/sync/queries/contactQuery';

type ContactChipsSectionProps = {
  scope: ContactScope;
  guardPress?: GuardPress;
  isLive?: boolean;
  isFlush?: boolean;
};

/**
 * A Contacts section that only shows who is in `scope` (on a post's photos, or on a photo opened in
 * a sheet): a chip per contact, opening it, none when no one is. Inside a sheet (New post or
 * Compare) the chips don't open a contact, which opens from the main app, never as a second sheet.
 * `guardPress` may wrap the presses (useDetailsPanelDrag's); `isLive: false` reads them once.
 */
export default function ContactChipsSection({
  scope,
  guardPress = unguarded,
  isLive,
  isFlush,
}: ContactChipsSectionProps) {
  const contacts = useContactRows({ scope }, { isLive });
  const isInSheet = !!useSheetRoute();

  if (!contacts?.length) return null;

  return (
    <>
      <ScreenSectionHeader title="Contacts" isFlush={isFlush} />
      <ChipRow>
        {contacts.map((contact) => (
          <Chip
            key={contact.id}
            label={contact.name}
            leading={<ContactAvatar contact={contact} size="chip" />}
            onPress={isInSheet ? undefined : guardPress(() => router.navigate(`/contact/${contact.id}`))}
          />
        ))}
      </ChipRow>
    </>
  );
}
