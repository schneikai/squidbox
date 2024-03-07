import { SafeAreaView, Modal, View, Text, StyleSheet } from 'react-native';

import { Button } from '@/components/Buttons';

export default function SyncErrorViewer({ assetsWithSyncErrors, close }) {
  return (
    <Modal animationType="slide" visible>
      <SafeAreaView>
        <View style={styles.container}>
          {assetsWithSyncErrors.map((asset) => (
            <Text key={asset.id}>{`Asset ${asset.id} - ${asset.syncError}`}</Text>
          ))}
          <Button title="Close" onPress={close} style={{ marginTop: 20 }} />
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 10,
  },
});
