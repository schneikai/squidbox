import { BlurView } from 'expo-blur';
import { useImperativeHandle, useState } from 'react';
import { Modal, Pressable, StyleSheet } from 'react-native';

import AssetImage from '@/components/AssetImage';
import { space } from '@/styles/designTokens';

// Opened through `ref` (`open(asset)`, `close()`), so a peek re-renders only this modal, not the
// screen behind it. The peek's release closes it; a tap does too, should a release ever be missed.
export default function AssetQuickViewModal({ ref }) {
  const [asset, setAsset] = useState(null);
  const close = () => setAsset(null);
  useImperativeHandle(ref, () => ({ open: setAsset, close }), []);

  if (!asset) return null;

  return (
    <Modal animationType="fade" transparent visible onRequestClose={close}>
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={close}
        accessibilityRole="button"
        accessibilityLabel="Close preview"
      >
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
    // eslint-disable-next-line no-restricted-syntax -- clears the status bar and home indicator, a safe-area inset in disguise
    paddingVertical: 50,
    paddingHorizontal: space.xl,
  },
});
