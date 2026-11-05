import { router } from 'expo-router';

import MenuButton from '@/components/MenuButton';
import MenuOption from '@/components/popup-menu-options/MenuOption';
import addToContactListHref from '@/features/contact-list-picker/addToContactListHref';
import useContacts from '@/features/contacts-context/useContacts';
import useDeleteContact from '@/features/contacts-context/useDeleteContact';

/**
 * A contact row's ⋯ menu: favorite, add to a list, delete, and inside a list (`listId`) remove from
 * that list.
 */
export default function ContactRowMenu({ contact, listId }) {
  const { toggleFavoriteContact, removeFromList } = useContacts();
  const deleteContactAsync = useDeleteContact();

  return (
    <MenuButton accessibilityLabel={`${contact.name} options`}>
      <MenuOption
        label={contact.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
        icon="heart"
        onPress={() => toggleFavoriteContact(contact.id)}
      />
      <MenuOption label="Add to list" icon="list" onPress={() => router.navigate(addToContactListHref([contact.id]))} />
      {listId && (
        <MenuOption label="Remove from list" icon="close" onPress={() => removeFromList(listId, contact.id)} />
      )}
      <MenuOption
        label="Delete contact"
        icon="trash"
        colorPalette="danger"
        onPress={() => deleteContactAsync(contact)}
      />
    </MenuButton>
  );
}
