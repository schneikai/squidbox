import apiWithAuthentication from './apiWithAuthentication';
import requireSession from './requireSession';
import sessionIdentity from './sessionIdentity';
import storeSessionFeaturesAsync from './storeSessionFeaturesAsync';

// Settings → Features: sets the signed-in account's features on the server (the account needs
// `manage_features`, which it keeps) and then in the session.
export default async function updateFeaturesAsync(features) {
  const identity = sessionIdentity(requireSession());
  const { data } = await apiWithAuthentication.put('me/features', { features }, { identity });
  await storeSessionFeaturesAsync(identity, data.user.features);
}
