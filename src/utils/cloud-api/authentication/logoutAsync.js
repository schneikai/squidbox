import { clearTokensAsync } from '../apiTokenStore';
import apiWithAuthentication from '../apiWithAuthentication';

export default async function logoutAsync() {
  // Always logout even if api communication fails.
  // We also use this behavior in CloudProvider#logoutAsync
  try {
    await apiWithAuthentication.post('auth/logout');
  } finally {
    await clearTokensAsync();
  }
}
