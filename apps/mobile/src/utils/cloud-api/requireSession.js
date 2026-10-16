import SessionChangedError from './SessionChangedError';
import { API_BASE_URL } from './apiBaseUrl';
import { getSession } from './sessionStore';

import { sameAccount } from '@/library/sameAccount';

// The one place that hands out the session for a request: it must have tokens obtained from this
// base URL (never sent to another server) and, when the caller works on behalf of an identity,
// still be that identity's, so no token is ever sent or refreshed for someone else.
export default function requireSession(identity) {
  const session = getSession();
  if (!session?.tokens || session.apiBaseUrl !== API_BASE_URL) throw new SessionChangedError('Not signed in');
  if (identity && !sameAccount(identity, session)) throw new SessionChangedError('Signed in as someone else');
  return session;
}
