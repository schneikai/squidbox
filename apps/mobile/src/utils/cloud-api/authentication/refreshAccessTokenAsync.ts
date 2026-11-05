import type { RefreshRequest, RefreshResponse } from '@squidbox/shared';

import SessionChangedError from '../SessionChangedError';
import api from '../api';
import errorResponse from '../errorResponse';
import requireSession from '../requireSession';
import { updateSession } from '../sessionStore';

import type { Session } from '@/library/session';
import type { SyncIdentity } from '@/library/sessionMatches';

let inFlightRefresh: Promise<string> | null = null;

// Refresh the session once for every concurrent caller. The server rotates refresh tokens, so a
// second parallel refresh with the same token would be rejected and sign the user out. Refreshes
// only for the identity the caller works for (requireSession); resolves the new access token.
export default function refreshAccessTokenAsync(identity?: SyncIdentity): Promise<string> {
  const { refreshToken } = requireSession(identity).tokens;
  inFlightRefresh ??= refreshOnceAsync(refreshToken).finally(() => {
    inFlightRefresh = null;
  });
  return inFlightRefresh;
}

async function refreshOnceAsync(refreshToken: string): Promise<string> {
  try {
    const body: RefreshRequest = { refreshToken };
    const { data } = await api.post<RefreshResponse>('auth/refresh', body);
    const tokens = { accessToken: data.accessToken, refreshToken: data.refreshToken };
    if (!(await replaceTokensAsync(refreshToken, tokens))) throw new SessionChangedError();
    return data.accessToken;
  } catch (error) {
    // Only a definitive "no" from the server ends the session. Network errors and rate limits keep
    // it, so being offline when the access token expires doesn't sign the user out. The session
    // keeps its owner: the library stays, nothing syncs until the owner signs in again. The caller
    // sees a session change, not a failure (a backup run writes no syncError for it).
    const status = errorResponse(error)?.status;
    if (status === undefined || ![400, 401, 403].includes(status)) throw error;
    await replaceTokensAsync(refreshToken, null);
    throw new SessionChangedError('The server rejected the session');
  }
}

// Writes `tokens` into the session that still holds the refreshed token, in one write; a newer
// sign-in that replaced it meanwhile keeps its own. Resolves whether it was still that session.
async function replaceTokensAsync(refreshedToken: string, tokens: Session['tokens']): Promise<boolean> {
  const next = await updateSession((session) =>
    session?.tokens?.refreshToken === refreshedToken ? { ...session, tokens } : session,
  );
  return next?.tokens === tokens;
}
