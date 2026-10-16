import { Alert } from 'react-native';

// Whether to sign out: at once when everything in the open library is synced, else after the user
// confirms (signing out pauses the backup; what is pending uploads at the next sign-in).
export default function confirmSignOutAsync({ pendingCount, atRiskCount }) {
  if (pendingCount === 0 && atRiskCount === 0) return Promise.resolve(true);
  return new Promise((resolve) => {
    Alert.alert("You have media that isn't backed up yet", 'It will upload the next time you sign in.', [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
      { text: 'Sign Out', style: 'destructive', onPress: () => resolve(true) },
    ]);
  });
}
