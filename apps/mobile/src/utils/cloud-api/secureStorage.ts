import * as SecureStore from 'expo-secure-store';

// The background uploader reads the session while the device is locked, so the keychain item must
// be accessible after the first unlock. The default accessibility fails those reads with "User
// interaction is not allowed" once the app goes to the background.
const options = { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK };
// For a value that names this device: never restored to another one from a backup.
const thisDeviceOnlyOptions = { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY };

export function getItemAsync(key: string): Promise<string | null> {
  return SecureStore.getItemAsync(key);
}

export function setItemAsync(key: string, value: string, { thisDeviceOnly = false } = {}): Promise<void> {
  return SecureStore.setItemAsync(key, value, thisDeviceOnly ? thisDeviceOnlyOptions : options);
}

export function deleteItemAsync(key: string): Promise<void> {
  return SecureStore.deleteItemAsync(key);
}
