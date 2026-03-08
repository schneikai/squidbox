import React from 'react';
import { Modal, View, StyleSheet } from 'react-native';
import CircularProgress from 'react-native-circular-progress-indicator';

export default function ProgressModal({ visible, progress }) {
  if (!visible) return null;
  return (
    <Modal transparent animationType="fade" visible>
      <View style={styles.modalBackground}>
        <CircularProgress value={progress} />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalBackground: {
    flex: 1,
    alignItems: 'center',
    flexDirection: 'column',
    justifyContent: 'space-around',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
  },
});
