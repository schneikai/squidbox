import SessionChangedError from './SessionChangedError';
import { getSession } from './sessionStore';

import { sameAccount } from '@/library/sameAccount';

// The one place that hands out the session for a request: it must have tokens and, when the caller
// works on behalf of an identity, still be that identity's. So no token is ever sent or refreshed
// for someone other than the user the work started for.
export default function requireSession(identity) {
  const session = getSession();
  if (!session?.tokens) throw new SessionChangedError('Not signed in');
  if (identity && !sameAccount(identity, session)) throw new SessionChangedError('Signed in as someone else');
  return session;
}
