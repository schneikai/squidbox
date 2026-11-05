import { router } from 'expo-router';

import Chip from '@/components/Chip';
import ChipRow from '@/components/ChipRow';
import ScreenSectionHeader from '@/components/ScreenSectionHeader';
import ContactAvatar from '@/features/contact-avatar/ContactAvatar';
import useContactRows from '@/features/contact-list/useContactRows';
import useSheetRoute from '@/hooks/useSheetRoute';

const identity = (onPress) => onPress;

/**
 * The Contacts section of a photo, album or post (`targetType`, `targetId`): a chip per contact on
 * it, opening the contact, and Add, which opens the Add contacts sheet (where one is taken off too).
 * Inside a sheet (a photo, album or post opened in New post or Compare) the chips only show who is
 * on it: a contact and the Add contacts sheet open from the main app, never as a second sheet or a
 * screen that edits as you type inside a draft. `guardPress` may wrap the presses (useDetailsPanelDrag's); `isLive: false` reads them once.
 */
export default function TargetContactsSection({ targetType, targetId, guardPress = identity, isLive, isFlush }) {
  const contacts = useContactRows({ scope: { targetType, targetId } }, { isLive });
  const isInSheet = !!useSheetRoute();

  if (isInSheet && !contacts?.length) return null;

  return (
    <>
      <ScreenSectionHeader title="Contacts" isFlush={isFlush} size="large" />
      <ChipRow>
        {contacts?.map((contact) => (
          <Chip
            key={contact.id}
            label={contact.name}
            size="large"
            leading={<ContactAvatar contact={contact} size="chip" />}
            onPress={isInSheet ? undefined : guardPress(() => router.navigate(`/contact/${contact.id}`))}
          />
        ))}
        {!isInSheet && (
          <Chip
            variant="add"
            size="large"
            label="Add"
            accessibilityLabel="Add contacts"
            onPress={guardPress(() => router.navigate({ pathname: '/add-contacts', params: { targetType, targetId } }))}
          />
        )}
      </ChipRow>
    </>
  );
}
