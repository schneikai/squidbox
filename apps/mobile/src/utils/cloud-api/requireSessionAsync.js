import { isSameIdentity } from './sessionIdentity';
import { getSessionAsync } from './sessionStore';

export class SessionChangedError extends Error {
  constructor(message = 'The session changed') {
    super(message);
    this.name = 'SessionChangedError';
  }
}

// The one place that hands out a session for a request: the stored session must have tokens and,
// when the caller works on behalf of an identity, still be that identity's. So no token is ever
// sent or refreshed for someone other than the user the work started for.
export default async function requireSessionAsync(identity) {
  const session = await getSessionAsync();
  if (!session?.tokens) throw new SessionChangedError('Not signed in');
  if (identity && !isSameIdentity(identity, session)) throw new SessionChangedError('Signed in as someone else');
  return session;
}
