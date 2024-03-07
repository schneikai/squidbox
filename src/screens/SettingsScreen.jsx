import { View, StyleSheet, Alert, Text } from 'react-native';

import { Button } from '@/components/Buttons';
import LoginForm from '@/components/LoginForm';
import LogoutButton from '@/components/LogoutButton';
import useCloud from '@/features/cloud/useCloud';
import CloudSyncControl from '@/features/cloud-sync/cloud-sync-control/CloudSyncControl';
import deleteLocalDataAsync from '@/utils/local-data/deleteLocalDataAsync';

export default function SettingsScreen({ route, navigation }) {
  const { isAuthenticated, user, loadDataAndSaveLocalAsync, backupDataAsync } = useCloud();

  async function handleDeleteLocalData(confirmed) {
    if (!confirmed) {
      Alert.alert('Delete local data', 'This cannot be undone. Are you sure?', [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Yes',
          onPress: () => {
            handleDeleteLocalData(true);
          },
        },
      ]);
      return;
    }

    await deleteLocalDataAsync();
    Alert.alert('Done! Please restart app.');
  }

  async function handleLoadDataFromServerAsync(confirmed) {
    if (!confirmed) {
      Alert.alert(
        'Load data from server?',
        'This will overwrite all local data with the data from the server. Are you sure?',
        [
          {
            text: 'Cancel',
            style: 'cancel',
          },
          {
            text: 'Yes',
            onPress: () => {
              handleLoadDataFromServerAsync(true);
            },
          },
        ],
      );
      return;
    }

    try {
      await deleteLocalDataAsync();
      await loadDataAndSaveLocalAsync();
      window.alert('Done! Reload app to see changes.');
    } catch (error) {
      window.alert(`Failed to load data from server. Error: ${error.message}`);
    }
  }

  async function backupDataToServerAsync(confirmed) {
    if (!confirmed) {
      Alert.alert('Backup data to server?', '', [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Yes',
          onPress: () => {
            backupDataToServerAsync(true);
          },
        },
      ]);
      return;
    }

    try {
      await backupDataAsync();
      window.alert('Done!');
    } catch (error) {
      window.alert(`Failed to save data to server. Error: ${error.message}`);
    }
  }

  if (isAuthenticated) {
    return (
      <View style={styles.container}>
        <Text style={{ marginBottom: 10 }}>Logged in as {user.email}</Text>

        <CloudSyncControl />

        <Button
          onPress={() => handleDeleteLocalData()}
          variant="danger"
          title="Delete local data"
          style={{ marginTop: 10 }}
        />
        <Button
          onPress={() => handleLoadDataFromServerAsync()}
          title="Load data from cloud"
          variant="danger"
          style={{ marginTop: 10 }}
        />
        <Button
          onPress={() => backupDataToServerAsync()}
          title="Backup data to cloud"
          variant="danger"
          style={{ marginTop: 10 }}
        />
        <LogoutButton style={{ marginTop: 10 }} />
      </View>
    );
  }

  if (!isAuthenticated) {
    return (
      <View style={styles.container}>
        <LoginForm />

        <Button
          onPress={() => handleDeleteLocalData()}
          variant="danger"
          title="Delete local data"
          style={{ marginTop: 10 }}
        />
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    alignItems: 'center',
  },
});
