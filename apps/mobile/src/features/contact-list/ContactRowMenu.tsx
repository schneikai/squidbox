import type { ContactRecord } from '@squidbox/shared';
import { router } from 'expo-router';

import MenuButton, { type MenuButtonProps } from '@/components/MenuButton';
import MenuOption from '@/components/popup-menu-options/MenuOption';
import addToContactListHref from '@/features/contact-list-picker/addToContactListHref';
import useContacts from '@/features/contacts-context/useContacts';
import useDeleteContact from '@/features/contacts-context/useDeleteContact';

/**
 * A contact row's menu: edit (the contact screen, which saves as you type), favorite, add to a list,
 * delete. `trigger` (MenuButton's) is the row, which opens it on a long press.
 */
type ContactRowMenuProps = {
  contact: Pick<ContactRecord, 'id' | 'name' | 'isFavorite'>;
  trigger: NonNullable<MenuButtonProps['trigger']>;
};

export default function ContactRowMenu({ contact, trigger }: ContactRowMenuProps) {
  const { toggleFavoriteContact } = useContacts();
  const deleteContactAsync = useDeleteContact();

  return (
    <MenuButton accessibilityLabel={`${contact.name} options`} trigger={trigger}>
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
