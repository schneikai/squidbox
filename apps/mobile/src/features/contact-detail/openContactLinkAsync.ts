import { CONTACT_HANDLE_BY_FIELD, CONTACT_HANDLES, normalizeHandle } from '@squidbox/shared';
import { Alert, Linking } from 'react-native';

import type { HandleFormField } from './contactFields';

// A handle as typed ("@maya", a pasted link), as its profile's path.
const handle = (value: string) => encodeURIComponent(normalizeHandle(value));

// Where each field opens, in the order to try: X in its app when it is installed (its scheme fails
// otherwise) and else on the web, the others' web profiles, and a WhatsApp chat for the phone number.
const LINKS: Record<HandleFormField, (value: string) => string[]> = {
  ...(Object.fromEntries(
    CONTACT_HANDLES.map(({ field, profileUrl }) => [field, (value: string) => [profileUrl(handle(value))]]),
  ) as Record<HandleFormField, (value: string) => string[]>),
  xHandle: (value) => [
    `twitter://user?screen_name=${handle(value)}`,
    CONTACT_HANDLE_BY_FIELD.xHandle.profileUrl(handle(value)),
  ],
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
      if (index === urls.length - 1)
        Alert.alert("Couldn't open the link", error instanceof Error ? error.message : String(error));
    }
  }
}
