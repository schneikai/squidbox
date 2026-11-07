import type { ContactLinkRecord } from '@squidbox/shared';
import { router } from 'expo-router';

import TargetContactChip from './TargetContactChip';

import Chip from '@/components/Chip';
import ChipRow from '@/components/ChipRow';
import ScreenSectionHeader from '@/components/ScreenSectionHeader';
import ContactAvatar from '@/features/contact-avatar/ContactAvatar';
import useContactRows from '@/features/contact-list/useContactRows';
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
 * contacts on its photos, by name with the ones on it; their × takes them off all its photos.
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
  const linked = useContactRows({ scope: { targetType, targetId } }, { isLive });
  // A photo has no photos of its own: the same read again, so the hooks stay the same.
  const onPhotos = useContactRows(
    { scope: targetType === 'asset' ? { targetType, targetId } : { photosOf: targetType, id: targetId } },
    { isLive },
  );
  const isInSheet = !!useSheetRoute();
  const linkedIds = new Set(linked?.map((contact) => contact.id));
  const contacts =
    linked &&
    [...linked, ...(onPhotos ?? []).filter((contact) => !linkedIds.has(contact.id))].sort(
      (a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }) || a.id.localeCompare(b.id),
    );

  if (isInSheet && !contacts?.length) return null;

  return (
    <>
      <ScreenSectionHeader title="Contacts" isFlush={isFlush} />
      <ChipRow>
        {contacts?.map((contact) =>
          isInSheet ? (
            <Chip
              key={contact.id}
              label={contact.name}
              size="large"
              leading={<ContactAvatar contact={contact} size="chip" />}
            />
          ) : (
            <TargetContactChip
              key={contact.id}
              contact={contact}
              targetType={targetType}
              targetId={targetId}
              isOnPhotos={!linkedIds.has(contact.id)}
              onOpen={guardPress(() => router.navigate(`/contact/${contact.id}`))}
            />
          ),
        )}
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
