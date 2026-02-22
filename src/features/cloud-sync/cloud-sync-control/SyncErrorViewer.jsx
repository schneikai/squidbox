import { Modal, View, Text, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/Buttons';

export default function SyncErrorViewer({ assetsWithSyncErrors, close }) {
  return (
    <Modal animationType="slide" visible>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.container}>
          {assetsWithSyncErrors.map((asset) => (
            <Text key={asset.id}>{`Asset ${asset.id} - ${asset.syncError}`}</Text>
          ))}
        </ScrollView>
        <Button title="Close" onPress={close} style={styles.closeButton} />
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    padding: 10,
  },
  closeButton: {
    margin: 20,
  },
});
