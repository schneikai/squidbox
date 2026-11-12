import { CONTACT_HANDLE_FIELDS, parseHandle } from '@squidbox/shared';
import { Alert, Linking } from 'react-native';

import type { HandleFormField } from './contactFields';
import handleLink from './handleLink';

import apiErrorMessage from '@/utils/cloud-api/apiErrorMessage';

// Where each field opens, in the order to try: X in its app on the handle's profile when it is
// installed (its scheme fails otherwise) and else on the web, the others' web profiles (a saved link
// as saved, handleLink), and a WhatsApp chat for the phone number. Nothing for a field with nothing
// to open.
const LINKS: Record<HandleFormField, (value: string) => string[]> = {
  ...(Object.fromEntries(
    CONTACT_HANDLE_FIELDS.map((field) => [
      field,
      (value: string) => {
        const link = handleLink(field, value);
        return link ? [link] : [];
      },
    ]),
  ) as Record<HandleFormField, (value: string) => string[]>),
  xHandle: (value) => {
    const { handle } = parseHandle(value, 'xHandle');
    const link = handleLink('xHandle', value);
    return [...(handle ? [`twitter://user?screen_name=${encodeURIComponent(handle)}`] : []), ...(link ? [link] : [])];
  },
  phoneNumber: (value) => [`https://wa.me/${value.replace(/\D/g, '').replace(/^0+/, '')}`],
};

/** Opens a contact's `field` (xHandle, …, phoneNumber) holding `value` where it lives; says so when it can't. */
export default async function openContactLinkAsync(field: HandleFormField, value: string): Promise<void> {
  const urls = LINKS[field](value);
  for (const [index, url] of urls.entries()) {
    try {
      await Linking.openURL(url);
      return;
    } catch (error) {
      if (index === urls.length - 1) Alert.alert("Couldn't open the link", apiErrorMessage(error));
    }
  }
}
