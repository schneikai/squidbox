import { BlurView } from 'expo-blur';
import { useImperativeHandle, useState } from 'react';
import { Modal, Pressable, StyleSheet } from 'react-native';

import AssetImage from '@/components/AssetImage';

// Opened through `ref` (`open(asset)`, `close()`), so a peek re-renders only this modal, not the
// screen behind it. The peek's release closes it; a tap does too, should a release ever be missed.
export default function AssetQuickViewModal({ ref }) {
  const [asset, setAsset] = useState(null);
  const close = () => setAsset(null);
  useImperativeHandle(ref, () => ({ open: setAsset, close }), []);

  if (!asset) return null;

  return (
    <Modal animationType="fade" transparent visible onRequestClose={close}>
      <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityRole="button" accessibilityLabel="Close preview">
        <BlurView intensity={20} style={styles.container}>
          <AssetImage asset={asset} contentFit="contain" placeholderColor="transparent" />
        </BlurView>
      </Pressable>
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
