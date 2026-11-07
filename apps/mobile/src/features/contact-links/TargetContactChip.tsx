import type { ContactLinkRecord } from '@squidbox/shared';

import Chip from '@/components/Chip';
import ContactAvatar from '@/features/contact-avatar/ContactAvatar';
import type { ContactSummary } from '@/features/contact-list/contactQuery';
import useContacts from '@/features/contacts-context/useContacts';

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
};

/**
 * A contact on a photo, album or post: a tap opens the contact (`onOpen`), its × takes it off, as a
 * list's × does on the contact screen.
 */
export default function TargetContactChip({ contact, targetType, targetId, onOpen }: TargetContactChipProps) {
  const { changeTargetContacts } = useContacts();

  function handleRemove() {
    changeTargetContacts({ targetType, targetId }, { added: [], removed: [contact.id] });
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
