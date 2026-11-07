import type { ContactLinkRecord } from '@squidbox/shared';

import Chip from '@/components/Chip';
import ContactAvatar from '@/features/contact-avatar/ContactAvatar';
import type { ContactSummary } from '@/features/contact-list/contactQuery';
import useContacts from '@/features/contacts-context/useContacts';
import confirmAsync from '@/utils/confirmAsync';

const TARGET_NAMES: Record<ContactLinkRecord['targetType'], string> = {
  asset: 'photo',
  album: 'album',
  post: 'post',
};

type TargetContactChipProps = {
  contact: ContactSummary;
  targetType: ContactLinkRecord['targetType'];
  targetId: string;
  onOpen: () => void;
  isOnPhotos?: boolean;
};

/**
 * A contact on a photo, album or post: a tap opens the contact (`onOpen`), its × takes it off, as a
 * list's × does on the contact screen. `isOnPhotos`: an album or post lists it through its photos,
 * so the × takes it off all of them, once confirmed.
 */
export default function TargetContactChip({
  contact,
  targetType,
  targetId,
  onOpen,
  isOnPhotos = false,
}: TargetContactChipProps) {
  const { changeTargetContacts, removeContactsFromPhotosOf } = useContacts();

  async function handleRemove() {
    if (!isOnPhotos || targetType === 'asset') {
      await changeTargetContacts({ targetType, targetId }, { added: [], removed: [contact.id] });
      return;
    }
    const isConfirmed = await confirmAsync({
      title: `Remove ${contact.name}?`,
      message: `${contact.name} comes off every photo of this ${TARGET_NAMES[targetType]} they are on.`,
      action: 'Remove',
      destructive: true,
    });
    if (isConfirmed) await removeContactsFromPhotosOf({ targetType, targetId }, [contact.id]);
  }

  return (
    <Chip
      label={contact.name}
      size="large"
      leading={<ContactAvatar contact={contact} size="chip" />}
      onPress={onOpen}
      onRemove={handleRemove}
      removeLabel={`Remove ${contact.name} from this ${TARGET_NAMES[targetType]}`}
    />
  );
}
