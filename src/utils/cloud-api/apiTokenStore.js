import * as SecureStore from 'expo-secure-store';

const API_TOKEN_STORAGE_KEY = 'accessToken';
const API_REFRESH_TOKEN_STORAGE_KEY = 'refreshToken';

export async function getAccessTokenAsync() {
  return SecureStore.getItemAsync(API_TOKEN_STORAGE_KEY);
}

export async function setAccessTokenAsync(accessToken) {
  return SecureStore.setItemAsync(API_TOKEN_STORAGE_KEY, accessToken);
}

export async function getRefreshTokenAsync() {
  return SecureStore.getItemAsync(API_REFRESH_TOKEN_STORAGE_KEY);
}

export async function setRefreshTokenAsync(refreshToken) {
  return SecureStore.setItemAsync(API_REFRESH_TOKEN_STORAGE_KEY, refreshToken);
}

export async function clearTokensAsync() {
  await SecureStore.deleteItemAsync(API_TOKEN_STORAGE_KEY);
  await SecureStore.deleteItemAsync(API_REFRESH_TOKEN_STORAGE_KEY);
}
