import { View } from 'react-native';

import useProgressOverlay from '@/components/progress-overlay/useProgressOverlay';
import { Button } from '@/components/Buttons';
import confirmLogoutAsync from '@/features/cloud/confirmLogoutAsync';
import useCloud from '@/features/cloud/useCloud';

export default function LogoutButton({ style }) {
  const { logoutAsync } = useCloud();
  const { showBlocking, hide: hideOverlay } = useProgressOverlay();

  async function handleLogoutAsync() {
    // TODO: We need a way to detect unsynced data and only ask for confirmation
    // if there is unsynced data. Otherwise we can just logout without confirmation.
    // We can already detect new unsynced Assets by checking the isSynced flag
    // but for the json data files we  don't have a way yet. We would need to keep
    // track when they were last synced and compare that to the last modified
    // date of the file.
    const confirmed = await confirmLogoutAsync();
    if (!confirmed) return;

    showBlocking();

    try {
      await logoutAsync();
    } finally {
      hideOverlay();
    }
  }

  return (
    <View style={style}>
      <Button onPress={() => handleLogoutAsync()} title="Logout" style={{ marginTop: 10 }} />
    </View>
  );
}
