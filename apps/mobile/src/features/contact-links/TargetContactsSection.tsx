import type { ContactLinkRecord } from '@squidbox/shared';
import { router } from 'expo-router';

import TargetContactChip from './TargetContactChip';
import useTargetContacts from './useTargetContacts';

import Chip from '@/components/Chip';
import ChipRow from '@/components/ChipRow';
import ScreenSectionHeader from '@/components/ScreenSectionHeader';
import ContactAvatar from '@/features/contact-avatar/ContactAvatar';
import useSheetRoute from '@/hooks/useSheetRoute';
import unguarded, { type GuardPress } from '@/lib/unguarded';

type TargetContactsSectionProps = {
  targetType: ContactLinkRecord['targetType'];
  targetId: string;
  guardPress?: GuardPress;
  isLive?: boolean;
  isFlush?: boolean;
};

/**
 * The Contacts section of a photo, album or post (`targetType`, `targetId`): a chip per contact on
 * it, opening the contact (its × takes it off, TargetContactChip), and Add, which
 * opens the Add contacts sheet (where one is taken off too). An album or post also lists the
 * contacts on its photos, by name with the ones on it; the × of one on its photos takes it off all of them, and off it.
 * Inside a sheet (a photo, album or post opened in New post or Compare) the chips only show who is
 * on it: a contact and the Add contacts sheet open from the main app, never as a second sheet or a
 * screen that edits as you type inside a draft. `guardPress` may wrap the presses (useDetailsPanelDrag's); `isLive: false` reads them once.
 */
export default function TargetContactsSection({
  targetType,
  targetId,
  guardPress = unguarded,
  isLive,
  isFlush,
}: TargetContactsSectionProps) {
  const people = useTargetContacts(targetType, targetId, { isLive });
  const isInSheet = !!useSheetRoute();
  const contacts = people?.contacts;

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
              targetType={targetType}
              targetId={targetId}
              isOnPhotos={!!people?.onPhotoIds.has(contact.id)}
              onOpen={guardPress(() => router.navigate(`/contact/${contact.id}`))}
            />
          ),
        )}
        {!isInSheet && (
          <Chip
            variant="add"
            label="Add"
            accessibilityLabel="Add contacts"
            onPress={guardPress(() => router.navigate({ pathname: '/add-contacts', params: { targetType, targetId } }))}
          />
        )}
      </ChipRow>
    </>
  );
}
