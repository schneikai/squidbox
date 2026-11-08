import confirmRemoveFromPhotos from './confirmRemoveFromPhotos';
import { contactsOfName, type ContactsOf } from './contactsOf';

import Chip from '@/components/Chip';
import ContactAvatar from '@/features/contact-avatar/ContactAvatar';
import type { ContactSummary } from '@/features/contact-list/contactQuery';
import useContacts from '@/features/contacts-context/useContacts';
import confirmAsync from '@/utils/confirmAsync';

type TargetContactChipProps = {
  contact: ContactSummary;
  of: ContactsOf;
  onOpen: () => void;
};

/**
 * A contact on a photo, or on an album's or post's photos (`of`): a tap opens the contact
 * (`onOpen`), its × takes it off the photo, or off every photo of the album or post, once confirmed.
 */
export default function TargetContactChip({ contact, of, onOpen }: TargetContactChipProps) {
  const { changePhotoContacts, changeContactsOnPhotosOf } = useContacts();
  const name = contactsOfName(of);

  async function handleRemove() {
    const change = { added: [], removed: [contact.id] };
    if ('assetId' in of) {
      const isConfirmed = await confirmAsync({
        title: `Remove ${contact.name}?`,
        message: `${contact.name} comes off this photo.`,
        action: 'Remove',
        destructive: true,
      });
      if (isConfirmed) await changePhotoContacts(of.assetId, change);
    } else if (await confirmRemoveFromPhotos([contact.name], name)) {
      await changeContactsOnPhotosOf(of, change);
    }
  }

  return (
    <Chip
      label={contact.name}
      leading={<ContactAvatar contact={contact} size="chip" />}
      onPress={onOpen}
      onRemove={handleRemove}
      removeLabel={`Remove ${contact.name} from ${'assetId' in of ? 'this photo' : `every photo of this ${name}`}`}
    />
  );
}
