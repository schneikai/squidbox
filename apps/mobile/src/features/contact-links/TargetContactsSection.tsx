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
 * The Contacts section of a photo or post (`of`): a chip per contact on the photo, or on any of the
 * post's photos (contacts go on photos only), opening the contact. A photo's chips also take a
 * contact off (their ×, TargetContactChip), and Add opens the Add contacts sheet. A post's only show
 * who is on its photos: a contact goes on a post's photo from that photo. Inside a sheet (a photo or
 * post opened in New post or Compare) the chips only show who is on it: a contact and the Add
 * contacts sheet open from the main app, never as a second sheet or a screen that edits as you type
 * inside a draft. A section that only shows has none when no one is on it. `guardPress` may wrap the
 * presses (useDetailsPanelDrag's); `isLive: false` reads them once.
 */
export default function TargetContactsSection({
  of,
  guardPress = unguarded,
  isLive,
  isFlush,
}: TargetContactsSectionProps) {
  const contacts = useContactRows({ scope: contactsOfScope(of) }, { isLive });
  const isInSheet = !!useSheetRoute();
  const assetId = !isInSheet && 'assetId' in of ? of.assetId : undefined;

  if (!assetId && !contacts?.length) return null;

  return (
    <>
      <ScreenSectionHeader title="Contacts" isFlush={isFlush} />
      <ChipRow>
        {contacts?.map((contact) => {
          const onOpen = isInSheet ? undefined : guardPress(() => router.navigate(`/contact/${contact.id}`));
          return assetId && onOpen ? (
            <TargetContactChip key={contact.id} contact={contact} assetId={assetId} onOpen={onOpen} />
          ) : (
            <Chip
              key={contact.id}
              label={contact.name}
              leading={<ContactAvatar contact={contact} size="chip" />}
              onPress={onOpen}
            />
          );
        })}
        {assetId && (
          <Chip
            variant="add"
            label="Add"
            accessibilityLabel="Add contacts"
            onPress={guardPress(() => router.navigate({ pathname: '/add-contacts', params: { assetId } }))}
          />
        )}
      </ChipRow>
    </>
  );
}
