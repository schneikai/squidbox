import { CONTACT_HANDLE_BY_FIELD, type Channel } from '@squidbox/shared';
import { Alert } from 'react-native';

import Button from '@/components/Button';
import MenuButton from '@/components/MenuButton';
import MenuOption from '@/components/popup-menu-options/MenuOption';
import type { MentionContact } from '@/features/post-mentions/mentionHandle';
import * as contactsRepository from '@/sync/contactsRepository';
import { getDb } from '@/sync/db/client';
import storedHandle from '@/utils/contacts/storedHandle';

type AddHandleButtonProps = {
  /** The mentioned contacts without a handle on `channel`. */
  contacts: MentionContact[];
  channel: Pick<Channel, 'name' | 'handleField'>;
};

/**
 * Add handle on a copy's card: asks for a contact's handle on the channel in one line (its field's
 * form as the hint) and stores it on the contact, as the contact's form stores a handle
 * (storedHandle). With several contacts, a menu of them first.
 */
export default function AddHandleButton({ contacts, channel }: AddHandleButtonProps) {
  const { label, placeholder } = CONTACT_HANDLE_BY_FIELD[channel.handleField];

  function ask(contact: MentionContact) {
    Alert.prompt(`${contact.name} on ${label}`, placeholder, async (typed: string) => {
      const handle = storedHandle(typed);
      if (!handle) return;
      try {
        await contactsRepository.update(getDb(), contact.id, { [channel.handleField]: handle });
      } catch (error) {
        console.error("Couldn't add the handle", error);
        Alert.alert("Couldn't add the handle");
      }
    });
  }

  if (contacts.length === 1) {
    return <Button variant="secondary" size="small" label="Add handle" onPress={() => ask(contacts[0]!)} />;
  }
  return (
    <MenuButton
      variant="secondary"
      size="small"
      label="Add handle"
      accessibilityLabel="Add handle"
      title="Add a handle for"
    >
      {contacts.map((contact) => (
        <MenuOption key={contact.id} label={contact.name} onPress={() => ask(contact)} />
      ))}
    </MenuButton>
  );
}
