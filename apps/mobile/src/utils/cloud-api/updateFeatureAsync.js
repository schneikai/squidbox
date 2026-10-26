import apiWithAuthentication from './apiWithAuthentication';
import requireSession from './requireSession';
import sessionIdentity from './sessionIdentity';
import storeSessionFeaturesAsync from './storeSessionFeaturesAsync';

// Settings → Features: switches one of the signed-in account's features on the server (the account
// needs `developer`), then stores the features it answered with in the session.
export default async function updateFeatureAsync(feature, isOn) {
  const identity = sessionIdentity(requireSession());
  const { data } = await apiWithAuthentication.patch('me/features', { feature, isOn }, { identity });
  await storeSessionFeaturesAsync(identity, data.user.features);
}
