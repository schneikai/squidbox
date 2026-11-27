import { CONTACT_HANDLE_BY_FIELD, type Channel } from '@squidbox/shared';
import { Alert } from 'react-native';

import type { MentionContact } from './mentionHandle';

import useContacts from '@/providers/contacts/useContacts';

/**
 * `ask(contact, channel)` asks for a contact's handle on the channel in one line (its field's form as
 * the hint) and stores it on the contact (setContactHandle, as the contact's form stores a handle):
 * Add handle on a missing-handle note and in a chip's sheet.
 */
export default function useAskHandle() {
  const { setContactHandle } = useContacts();

  function ask(contact: MentionContact, channel: Pick<Channel, 'handleField'>) {
    const { label, placeholder } = CONTACT_HANDLE_BY_FIELD[channel.handleField];
    Alert.prompt(`${contact.name} on ${label}`, placeholder, async (typed: string) => {
      try {
        await setContactHandle(contact.id, channel.handleField, typed);
      } catch (error) {
        console.error("Couldn't add the handle", error);
        Alert.alert("Couldn't add the handle");
      }
    });
  }

  return ask;
}
