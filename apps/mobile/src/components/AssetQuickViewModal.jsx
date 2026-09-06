import { BlurView } from 'expo-blur';
import { useState } from 'react';
import { Modal, StyleSheet } from 'react-native';

import AssetImage from '@/components/AssetImage';

export function useAssetQuickViewModal() {
  const [asset, setAsset] = useState(null);

  function open(asset) {
    setAsset(asset);
  }

  function close() {
    setAsset(null);
  }

  return {
    asset,
    open,
    close,
  };
}

export default function AssetQuickViewModal({ asset, isVisible }) {
  if (!asset) return;

  return (
    <Modal animationType="fade" transparent visible={isVisible}>
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
