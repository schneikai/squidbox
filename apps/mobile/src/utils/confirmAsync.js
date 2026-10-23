import { Alert } from 'react-native';

// Whether the user confirmed `action` in a Cancel · `action` alert below `title` and `message`. A
// `destructive` action shows in red: anything that deletes, discards or signs out. Dismissing the
// alert by tapping outside it (Android) counts as Cancel.
export default function confirmAsync({ title, message = '', action, destructive = false }) {
  return new Promise((resolve) => {
    Alert.alert(
      title,
      message,
      [
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
        { text: action, style: destructive ? 'destructive' : 'default', onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}
