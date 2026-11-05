import { router } from 'expo-router';

import ContactChip from './ContactChip';
import useTargetContacts from './useTargetContacts';

import Chip from '@/components/Chip';
import ChipRow from '@/components/ChipRow';
import ScreenSectionHeader from '@/components/ScreenSectionHeader';

const identity = (onPress) => onPress;

/**
 * The Contacts section of a photo, album or post (`targetType`, `targetId`): a chip per contact on
 * it, opening the contact, and Add, which opens the Add contacts sheet (where one is taken off too).
 * `guardPress` may wrap the presses (useDetailsPanelDrag's); `isLive: false` reads them once.
 */
export default function TargetContactsSection({ targetType, targetId, guardPress = identity, isLive, isFlush }) {
  const contacts = useTargetContacts({ targetType, targetId }, { isLive });

  return (
    <>
      <ScreenSectionHeader title="Contacts" isFlush={isFlush} />
      <ChipRow>
        {contacts?.map((contact) => (
          <ContactChip
            key={contact.id}
            contact={contact}
            onPress={guardPress(() => router.navigate(`/contact/${contact.id}`))}
          />
        ))}
        <Chip
          variant="add"
          label="Add"
          accessibilityLabel="Add contacts"
          onPress={guardPress(() => router.navigate({ pathname: '/add-contacts', params: { targetType, targetId } }))}
        />
      </ChipRow>
    </>
  );
}
