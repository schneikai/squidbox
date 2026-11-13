import type { ContactRecord } from '@squidbox/shared';
import { router } from 'expo-router';
import { Share } from 'react-native';

import handleLink from './handleLink';

import MenuButton from '@/components/MenuButton';
import MenuOption from '@/components/popup-menu-options/MenuOption';
import addToContactListHref from '@/features/contact-list-picker/addToContactListHref';
import useContacts from '@/providers/contacts/useContacts';
import useDeleteContact from '@/providers/contacts/useDeleteContact';

/**
 * The contact screen's ⋯ menu: add to a list, share the X profile (with an X handle), remove the
 * photo (with one), delete.
 */
type ContactMenuProps = {
  contact: Pick<ContactRecord, 'id' | 'name' | 'xHandle' | 'avatarFilename'>;
  afterDelete?: () => void;
};

export default function ContactMenu({ contact, afterDelete }: ContactMenuProps) {
  const { removeAvatar } = useContacts();
  const deleteContactAsync = useDeleteContact();
  const xLink = handleLink('xHandle', contact.xHandle ?? '');

  return (
    <MenuButton accessibilityLabel="Contact options">
      <MenuOption label="Add to list" icon="list" onPress={() => router.navigate(addToContactListHref([contact.id]))} />
      {!!xLink && (
        <MenuOption
          label="Share profile link"
          icon="share"
          onPress={() => Share.share({ url: xLink, message: xLink })}
        />
      )}
      {!!contact.avatarFilename && (
        <MenuOption label="Remove photo" icon="image" onPress={() => removeAvatar(contact.id)} />
      )}
      <MenuOption
        label="Delete contact"
        icon="trash"
        colorPalette="danger"
        onPress={() => deleteContactAsync(contact, { beforeDelete: afterDelete })}
      />
    </MenuButton>
  );
}
