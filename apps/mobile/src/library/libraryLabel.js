import { Platform } from 'react-native';

// How a library is named to the user: the account's email, or this device.
export default function libraryLabel(library) {
  if (library.owner.kind === 'account') return library.owner.email || 'Your account';
  if (Platform.OS !== 'ios') return 'This device';
  return Platform.isPad ? 'This iPad' : 'This iPhone';
}
