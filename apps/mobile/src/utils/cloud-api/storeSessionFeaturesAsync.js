import { updateSession } from './sessionStore';

import { sameAccount } from '@/library/sameAccount';

// Writes the account's features, as the server answered them, into the session, only while it is
// still the session of `identity` (and only when they changed).
export default async function storeSessionFeaturesAsync(identity, features) {
  await updateSession((current) =>
    current && sameAccount(identity, current) && JSON.stringify(current.features) !== JSON.stringify(features)
      ? { ...current, features }
      : current,
  );
}
