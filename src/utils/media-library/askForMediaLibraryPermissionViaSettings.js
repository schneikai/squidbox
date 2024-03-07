import { Alert, Linking } from 'react-native';

export default function askForMediaLibraryPermissionViaSettings() {
  Alert.alert('Permission required', 'Please allow this app access to your photos library.', [
    { text: 'YES', onPress: () => Linking.openSettings() },
    { text: 'NO' },
  ]);
}
