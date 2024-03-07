import React from 'react';
import { Modal, View, StyleSheet, ActivityIndicator } from 'react-native';

export default function BlockingModal({ visible }) {
  return (
    <Modal transparent animationType="fade" visible={visible}>
      <View style={styles.modalBackground}>
        <ActivityIndicator size="large" />
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
