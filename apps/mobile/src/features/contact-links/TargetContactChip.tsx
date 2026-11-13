import Chip from '@/components/Chip';
import ContactAvatar from '@/features/contact-avatar/ContactAvatar';
import useContacts from '@/providers/contacts/useContacts';
import type { ContactSummary } from '@/sync/queries/contactQuery';
import confirmAsync from '@/utils/confirmAsync';

type TargetContactChipProps = {
  contact: ContactSummary;
  assetId: string;
  onOpen: () => void;
};

/** A contact on a photo (`assetId`): a tap opens the contact (`onOpen`), its × takes it off the photo, once confirmed. */
export default function TargetContactChip({ contact, assetId, onOpen }: TargetContactChipProps) {
  const { changePhotoContacts } = useContacts();

  async function handleRemove() {
    const isConfirmed = await confirmAsync({
      title: `Remove ${contact.name}?`,
      message: `${contact.name} comes off this photo.`,
      action: 'Remove',
      destructive: true,
    });
    if (isConfirmed) await changePhotoContacts(assetId, { added: [], removed: [contact.id] });
  }

  return (
    <Chip
      label={contact.name}
      leading={<ContactAvatar contact={contact} size="chip" />}
      onPress={onOpen}
      onRemove={handleRemove}
      removeLabel={`Remove ${contact.name} from this photo`}
    />
  );
}
