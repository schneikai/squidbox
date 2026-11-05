import { router } from 'expo-router';

import MenuButton from '@/components/MenuButton';
import MenuOption from '@/components/popup-menu-options/MenuOption';
import useContacts from '@/features/contacts-context/useContacts';
import confirmAsync from '@/utils/confirmAsync';

/**
 * A contact row's ⋯ menu: favorite, add to a list, delete, and inside a list (`listId`) remove from
 * that list.
 */
export default function ContactRowMenu({ contact, listId }) {
  const { toggleFavoriteContact, setContactDeleted, removeFromList } = useContacts();

  async function handleDelete() {
    const confirmed = await confirmAsync({
      title: `Delete ${contact.name}?`,
      message: 'They leave your lists and the photos, albums and posts they are on.',
      action: 'Delete contact',
      destructive: true,
    });
    if (confirmed) await setContactDeleted(contact.id);
  }

  return (
    <MenuButton accessibilityLabel={`${contact.name} options`}>
      <MenuOption
        label={contact.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
        icon="heart"
        onPress={() => toggleFavoriteContact(contact.id)}
      />
      <MenuOption
        label="Add to list"
        icon="list"
        onPress={() => router.navigate({ pathname: '/add-to-contact-list', params: { contactIds: contact.id } })}
      />
      {listId && (
        <MenuOption label="Remove from list" icon="close" onPress={() => removeFromList(listId, contact.id)} />
      )}
      <MenuOption label="Delete contact" icon="trash" colorPalette="danger" onPress={handleDelete} />
    </MenuButton>
  );
}
