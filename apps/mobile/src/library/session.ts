// The stored session (utils/cloud-api/sessionStore.js), as the library code reads it.
export interface Session {
  serverId: string;
  userId: string;
  email: string | null;
  // The account's features (users.features); missing in a session stored before them.
  features?: string[];
  apiBaseUrl: string;
  tokens: { accessToken: string; refreshToken: string } | null;
}
