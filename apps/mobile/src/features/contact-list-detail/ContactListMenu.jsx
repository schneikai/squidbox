import { CONTACT_LIST_LIMITS } from '@squidbox/shared';
import { Alert } from 'react-native';

import MenuButton from '@/components/MenuButton';
import MenuOption from '@/components/popup-menu-options/MenuOption';
import useContacts from '@/features/contacts-context/useContacts';
import confirmAsync from '@/utils/confirmAsync';

/** A contact list's ⋯ menu: rename it, delete it (its contacts stay). */
export default function ContactListMenu({ list, afterDelete }) {
  const { updateList, setListDeleted } = useContacts();

  function handleRename() {
    Alert.prompt(
      'Rename list',
      undefined,
      (name) => {
        if (name?.trim()) updateList(list.id, { name: name.trim().slice(0, CONTACT_LIST_LIMITS.name) });
      },
      'plain-text',
      list.name,
    );
  }

  async function handleDelete() {
    const confirmed = await confirmAsync({
      title: `Delete ${list.name}?`,
      message: 'Its contacts stay in your contacts.',
      action: 'Delete list',
      destructive: true,
    });
    if (!confirmed) return;
    afterDelete();
    await setListDeleted(list.id);
  }

  return (
    <MenuButton accessibilityLabel="List options">
      <MenuOption label="Rename" icon="edit" onPress={handleRename} />
      <MenuOption label="Delete list" icon="trash" colorPalette="danger" onPress={handleDelete} />
    </MenuButton>
  );
}
