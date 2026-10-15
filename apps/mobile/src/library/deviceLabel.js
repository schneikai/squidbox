import { Platform } from 'react-native';

// This device, as the user knows it.
export default function deviceLabel() {
  if (Platform.OS !== 'ios') return 'This device';
  return Platform.isPad ? 'This iPad' : 'This iPhone';
}
