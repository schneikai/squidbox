// The stored session (utils/cloud-api/sessionStore.ts), as the library code reads it.
export interface Session {
  serverId: string;
  userId: string;
  email: string | null;
  // The account's features (users.features); missing in a session stored before them.
  features?: string[];
  apiBaseUrl: string;
  tokens: { accessToken: string; refreshToken: string } | null;
}

// A session that holds its tokens: one requests may be sent for.
export type AuthenticatedSession = Session & { tokens: NonNullable<Session['tokens']> };

export function hasTokens(session: Session | null): session is AuthenticatedSession {
  return Boolean(session?.tokens);
}
