// Web is a dev preview (see README → "Web preview"), where SecureStore doesn't exist.
const API_TOKEN_STORAGE_KEY = 'accessToken';
const API_REFRESH_TOKEN_STORAGE_KEY = 'refreshToken';

export async function getAccessTokenAsync() {
  return localStorage.getItem(API_TOKEN_STORAGE_KEY);
}

export async function setAccessTokenAsync(accessToken) {
  localStorage.setItem(API_TOKEN_STORAGE_KEY, accessToken);
}

export async function getRefreshTokenAsync() {
  return localStorage.getItem(API_REFRESH_TOKEN_STORAGE_KEY);
}

export async function setRefreshTokenAsync(refreshToken) {
  localStorage.setItem(API_REFRESH_TOKEN_STORAGE_KEY, refreshToken);
}

export async function clearTokensAsync() {
  localStorage.removeItem(API_TOKEN_STORAGE_KEY);
  localStorage.removeItem(API_REFRESH_TOKEN_STORAGE_KEY);
}
