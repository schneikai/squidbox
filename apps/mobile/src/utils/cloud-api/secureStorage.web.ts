import type * as native from './secureStorage';

// Web is a dev preview (see README → "Web preview"), where SecureStore doesn't exist.
export async function getItemAsync(key: string): ReturnType<typeof native.getItemAsync> {
  return localStorage.getItem(key);
}

export async function setItemAsync(key: string, value: string): ReturnType<typeof native.setItemAsync> {
  localStorage.setItem(key, value);
}

export async function deleteItemAsync(key: string): ReturnType<typeof native.deleteItemAsync> {
  localStorage.removeItem(key);
}
