// Web is a dev preview (see README → "Web preview"), where SecureStore doesn't exist.
export async function getItemAsync(key: string): Promise<string | null> {
  return localStorage.getItem(key);
}

// `thisDeviceOnly` is the native keychain's; localStorage stays in this browser anyway.
export async function setItemAsync(
  key: string,
  value: string,
  _options: { thisDeviceOnly?: boolean } = {},
): Promise<void> {
  localStorage.setItem(key, value);
}

export async function deleteItemAsync(key: string): Promise<void> {
  localStorage.removeItem(key);
}
