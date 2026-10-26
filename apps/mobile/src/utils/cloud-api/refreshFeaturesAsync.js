import apiWithAuthentication from './apiWithAuthentication';
import requireSession from './requireSession';
import sessionIdentity from './sessionIdentity';
import { updateSession } from './sessionStore';

import { sameAccount } from '@/library/sameAccount';

// Reads the signed-in account's features from /me into the session, so a grant on the server shows
// on the next launch without signing in again. Only into the session it asked for; rejects when
// there is no usable session or the server can't be reached, for the caller to ignore.
export default async function refreshFeaturesAsync() {
  const identity = sessionIdentity(requireSession());
  const { data } = await apiWithAuthentication.get('me', { identity });
  const features = data.user.features ?? [];
  await updateSession((current) =>
    current && sameAccount(identity, current) && String(current.features) !== String(features)
      ? { ...current, features }
      : current,
  );
}
