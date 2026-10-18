// The stored session (utils/cloud-api/sessionStore.js), as the library code reads it.
export interface Session {
  serverId: string;
  userId: string;
  email: string | null;
  apiBaseUrl: string;
  tokens: { accessToken: string; refreshToken: string } | null;
}
