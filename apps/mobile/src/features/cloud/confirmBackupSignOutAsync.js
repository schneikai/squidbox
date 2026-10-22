import confirmSignOutAsync from './confirmSignOutAsync';

// Whether to sign out from Settings: at once when everything in the open library is synced (no
// pending change, no photo waiting for its upload or failed), else after the user confirms (signing
// out pauses the backup; what is pending uploads at the next sign-in).
export default function confirmBackupSignOutAsync({ pendingCount, unsyncedCount, syncErrorCount }) {
  if (pendingCount + unsyncedCount + syncErrorCount === 0) return Promise.resolve(true);
  return confirmSignOutAsync({
    title: "You have media that isn't backed up yet",
    message: 'It will upload the next time you sign in.',
  });
}
