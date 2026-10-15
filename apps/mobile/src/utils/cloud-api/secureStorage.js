import * as SecureStore from 'expo-secure-store';

// The background uploader reads the session while the device is locked, so the keychain item must
// be accessible after the first unlock. The default accessibility fails those reads with "User
// interaction is not allowed" once the app goes to the background.
const options = { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK };

export function getItemAsync(key) {
  return SecureStore.getItemAsync(key);
}

export function setItemAsync(key, value) {
  return SecureStore.setItemAsync(key, value, options);
}

export function deleteItemAsync(key) {
  return SecureStore.deleteItemAsync(key);
}
