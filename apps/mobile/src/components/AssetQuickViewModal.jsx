import { BlurView } from 'expo-blur';
import { useImperativeHandle, useState } from 'react';
import { Modal, StyleSheet } from 'react-native';

import AssetImage from '@/components/AssetImage';

// Opened through `ref` (`open(asset)`, `close()`), so a peek re-renders only this modal, not the
// screen behind it.
export default function AssetQuickViewModal({ ref }) {
  const [asset, setAsset] = useState(null);
  useImperativeHandle(ref, () => ({ open: setAsset, close: () => setAsset(null) }), []);

  if (!asset) return null;

  return (
    <Modal animationType="fade" transparent visible>
      <BlurView intensity={20} style={styles.container}>
        <AssetImage asset={asset} contentFit="contain" placeholderColor="transparent" />
      </BlurView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingVertical: 50,
    paddingHorizontal: 20,
  },
});
