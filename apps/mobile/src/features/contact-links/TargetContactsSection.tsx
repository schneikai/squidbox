import { router } from 'expo-router';

import TargetContactChip from './TargetContactChip';
import { type ContactsOf, contactsOfScope } from './contactsOf';

import Chip from '@/components/Chip';
import ChipRow from '@/components/ChipRow';
import ScreenSectionHeader from '@/components/ScreenSectionHeader';
import ContactAvatar from '@/features/contact-avatar/ContactAvatar';
import useContactRows from '@/features/contact-list/useContactRows';
import useSheetRoute from '@/hooks/useSheetRoute';
import unguarded, { type GuardPress } from '@/lib/unguarded';

type TargetContactsSectionProps = {
  of: ContactsOf;
  guardPress?: GuardPress;
  isLive?: boolean;
  isFlush?: boolean;
};

/**
 * The Contacts section of a photo, album or post (`of`): a chip per contact on the photo, or on any
 * of the album's or post's photos (contacts go on photos only), opening the contact (its × takes it
 * off, TargetContactChip), and Add, which opens the Add contacts sheet (where one is taken off too).
 * Inside a sheet (a photo, album or post opened in New post or Compare) the chips only show who is
 * on it: a contact and the Add contacts sheet open from the main app, never as a second sheet or a
 * screen that edits as you type inside a draft. `guardPress` may wrap the presses
 * (useDetailsPanelDrag's); `isLive: false` reads them once.
 */
export default function TargetContactsSection({
  of,
  guardPress = unguarded,
  isLive,
  isFlush,
}: TargetContactsSectionProps) {
  const contacts = useContactRows({ scope: contactsOfScope(of) }, { isLive });
  const isInSheet = !!useSheetRoute();

  if (isInSheet && !contacts?.length) return null;

  return (
    <>
      <ScreenSectionHeader title="Contacts" isFlush={isFlush} />
      <ChipRow>
        {contacts?.map((contact) =>
          isInSheet ? (
            <Chip key={contact.id} label={contact.name} leading={<ContactAvatar contact={contact} size="chip" />} />
          ) : (
            <TargetContactChip
              key={contact.id}
              contact={contact}
              of={of}
              onOpen={guardPress(() => router.navigate(`/contact/${contact.id}`))}
            />
          ),
        )}
        {!isInSheet && (
          <Chip
            variant="add"
            label="Add"
            accessibilityLabel="Add contacts"
            onPress={guardPress(() => router.navigate({ pathname: '/add-contacts', params: of }))}
          />
        )}
      </ChipRow>
    </>
  );
}
