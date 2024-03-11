import * as SecureStore from 'expo-secure-store';

const API_TOKEN_STORAGE_KEY = 'accessToken';
const API_REFRESH_TOKEN_STORAGE_KEY = 'refreshToken';

// For the background uploader we need to modify the keychainAccessible option
// to be accessible even if the device is locked (needs to be unlocked once after reboot though).
// If this is left on the default setting you get a error
// "User interaction is not allowed. Calling the 'getValueWithKeyAsync' function has failed"
// when uploading files and the app goes to background.
// If this still doesn't work you can try to use SecureStore.ALWAYS.
const default_options = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
};

export async function getAccessTokenAsync() {
  return SecureStore.getItemAsync(API_TOKEN_STORAGE_KEY);
}

export async function setAccessTokenAsync(accessToken) {
  return SecureStore.setItemAsync(API_TOKEN_STORAGE_KEY, accessToken, default_options);
}

export async function getRefreshTokenAsync() {
  return SecureStore.getItemAsync(API_REFRESH_TOKEN_STORAGE_KEY);
}

export async function setRefreshTokenAsync(refreshToken) {
  return SecureStore.setItemAsync(API_REFRESH_TOKEN_STORAGE_KEY, refreshToken, default_options);
}

export async function clearTokensAsync() {
  await SecureStore.deleteItemAsync(API_TOKEN_STORAGE_KEY);
  await SecureStore.deleteItemAsync(API_REFRESH_TOKEN_STORAGE_KEY);
}
