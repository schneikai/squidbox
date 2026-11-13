import * as Updates from 'expo-updates';

/**
 * Fetches this build's newest EAS update and restarts into it ('restarting'), for the update gate
 * (docs/sync-design.md §15). 'needs-build' when there is none to fetch, or where updates are off (a
 * dev client, the web): only installing a newer build helps then. A failed check or fetch rejects.
 */
export async function updateApp(): Promise<'restarting' | 'needs-build'> {
  if (!Updates.isEnabled) return 'needs-build';
  const check = await Updates.checkForUpdateAsync();
  if (!check.isAvailable) return 'needs-build';
  const fetched = await Updates.fetchUpdateAsync();
  if (!fetched.isNew) return 'needs-build';
  await Updates.reloadAsync();
  return 'restarting';
}
