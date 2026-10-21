import { Alert } from 'react-native';

// Whether to sign out, after the user confirms with Cancel · Sign Out, below `title` and `message`.
export default function confirmSignOutAsync({ title, message }) {
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
      { text: 'Sign Out', style: 'destructive', onPress: () => resolve(true) },
    ]);
  });
}
