import { Alert } from 'react-native';

export default function confirmLogoutAsync() {
  return new Promise((resolve) => {
    Alert.alert(
      'Sign out?',
      'Your library stays on this iPhone.',
      [
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Sign out', style: 'destructive', onPress: () => resolve(true) },
      ],
      { cancelable: false },
    );
  });
}
