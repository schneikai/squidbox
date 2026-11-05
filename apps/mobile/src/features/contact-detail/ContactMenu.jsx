import { router } from 'expo-router';
import { Share } from 'react-native';

import MenuButton from '@/components/MenuButton';
import MenuOption from '@/components/popup-menu-options/MenuOption';
import useContacts from '@/features/contacts-context/useContacts';
import confirmAsync from '@/utils/confirmAsync';

/** The contact screen's ⋯ menu: add to a list, share the X profile (with an X handle), delete. */
export default function ContactMenu({ contact, afterDelete }) {
  const { setContactDeleted } = useContacts();

  async function handleDelete() {
    const confirmed = await confirmAsync({
      title: `Delete ${contact.name}?`,
      message: 'They leave your lists and the photos, albums and posts they are on.',
      action: 'Delete contact',
      destructive: true,
    });
    if (!confirmed) return;
    afterDelete();
    await setContactDeleted(contact.id);
  }

  return (
    <MenuButton accessibilityLabel="Contact options">
      <MenuOption
        label="Add to list"
        icon="list"
        onPress={() => router.navigate({ pathname: '/add-to-contact-list', params: { contactIds: contact.id } })}
      />
      {!!contact.xHandle && (
        <MenuOption
          label="Share profile link"
          icon="share"
          onPress={() =>
            Share.share({ url: `https://x.com/${contact.xHandle}`, message: `https://x.com/${contact.xHandle}` })
          }
        />
      )}
      <MenuOption label="Delete contact" icon="trash" colorPalette="danger" onPress={handleDelete} />
    </MenuButton>
  );
}
