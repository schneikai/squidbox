// Opens the system share sheet for a local file and resolves once it's asked to show; a later
// failure goes to `onError`. Not awaited further: iOS never settles when an activity is picked and
// then cancelled. Only where canShareFiles: expo-sharing throws on import in a build without it.
export default async function shareFileAsync(uri, _filename, onError) {
  const Sharing = require('expo-sharing');
  Sharing.shareAsync(uri).catch(onError);
}
