import { Alert, Linking } from 'react-native';

const handle = (value) => encodeURIComponent(value.trim());

// Where each field opens, in the order to try: X in its app when it is installed (its scheme fails
// otherwise) and else on the web, the others' web profiles, and a WhatsApp chat for the phone number.
const LINKS = {
  xHandle: (value) => [`twitter://user?screen_name=${handle(value)}`, `https://x.com/${handle(value)}`],
  blueskyHandle: (value) => [`https://bsky.app/profile/${handle(value)}`],
  onlyFansHandle: (value) => [`https://onlyfans.com/${handle(value)}`],
  jffHandle: (value) => [`https://justfor.fans/${handle(value)}`],
  phoneNumber: (value) => [`https://wa.me/${value.replace(/\D/g, '').replace(/^0+/, '')}`],
};

/** Opens a contact's `field` (xHandle, …, phoneNumber) holding `value` where it lives; says so when it can't. */
export default async function openContactLinkAsync(field, value) {
  const urls = LINKS[field](value);
  for (const [index, url] of urls.entries()) {
    try {
      await Linking.openURL(url);
      return;
    } catch (error) {
      if (index === urls.length - 1) Alert.alert("Couldn't open the link", error.message);
    }
  }
}
