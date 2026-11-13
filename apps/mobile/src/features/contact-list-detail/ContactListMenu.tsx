import type { ContactListRecord } from '@squidbox/shared';
import { router } from 'expo-router';

import MenuButton, { type MenuButtonProps } from '@/components/MenuButton';
import MenuOption from '@/components/popup-menu-options/MenuOption';
import useContacts from '@/providers/contacts/useContacts';
import confirmDeleteAsync from '@/utils/confirmDeleteAsync';

/**
 * A contact list's menu: Edit list (its name and description, in a sheet), delete it (its contacts
 * stay), then `afterDelete` (leaving its screen). The ⋯ button, or `trigger` (MenuButton's): its row
 * in the Lists screen, on a long press.
 */
type ContactListMenuProps = {
  list: Pick<ContactListRecord, 'id' | 'name'>;
  afterDelete?: () => void;
  trigger?: MenuButtonProps['trigger'];
};

export default function ContactListMenu({ list, afterDelete, trigger }: ContactListMenuProps) {
  const { setListDeleted } = useContacts();

  async function handleDelete() {
    const confirmed = await confirmDeleteAsync({ name: list.name, also: 'Its contacts stay in your contacts.' });
    if (!confirmed) return;
    afterDelete?.();
    await setListDeleted(list.id);
  }

  return (
    <MenuButton accessibilityLabel="List options" trigger={trigger}>
      <MenuOption label="Edit list" icon="edit" onPress={() => router.navigate(`/contact-list/${list.id}/edit`)} />
      <MenuOption label="Delete list" icon="trash" colorPalette="danger" onPress={handleDelete} />
    </MenuButton>
  );
}
