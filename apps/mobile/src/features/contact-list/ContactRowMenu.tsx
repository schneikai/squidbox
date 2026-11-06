import type { ContactRecord } from '@squidbox/shared';
import { router } from 'expo-router';

import MenuButton from '@/components/MenuButton';
import MenuOption from '@/components/popup-menu-options/MenuOption';
import addToContactListHref from '@/features/contact-list-picker/addToContactListHref';
import useContacts from '@/features/contacts-context/useContacts';
import useDeleteContact from '@/features/contacts-context/useDeleteContact';

/** A contact row's ⋯ menu: edit (the contact screen, which saves as you type), favorite, add to a list, delete. */
type ContactRowMenuProps = { contact: Pick<ContactRecord, 'id' | 'name' | 'isFavorite'> };

export default function ContactRowMenu({ contact }: ContactRowMenuProps) {
  const { toggleFavoriteContact } = useContacts();
  const deleteContactAsync = useDeleteContact();

  return (
    <MenuButton accessibilityLabel={`${contact.name} options`}>
      <MenuOption label="Edit contact" icon="edit" onPress={() => router.navigate(`/contact/${contact.id}`)} />
      <MenuOption
        label={contact.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
        icon="heart"
        onPress={() => toggleFavoriteContact(contact.id)}
      />
      <MenuOption label="Add to list" icon="list" onPress={() => router.navigate(addToContactListHref([contact.id]))} />
      <MenuOption
        label="Delete contact"
        icon="trash"
        colorPalette="danger"
        onPress={() => deleteContactAsync(contact)}
      />
    </MenuButton>
  );
}
