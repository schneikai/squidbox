import { BlurView } from 'expo-blur';
import { useRef, useSyncExternalStore } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import quickViewStore from './quickViewStore';

import AssetImage from '@/components/AssetImage';
import FadeView from '@/components/FadeView';

const close = () => quickViewStore.set(null);

/**
 * The quick view (a long-press peek at a photo) over the whole surface: one host at the app root and
 * one in each sheet (SheetRoute, with its `routeKey`), each showing the peeks opened in its surface.
 * Rendered in-tree, never in a native Modal: a Modal takes the touch away from the cell or grid
 * gesture that opened the peek, and that touch's release is what closes it. A tap closes it too,
 * should a release ever be missed.
 */
export default function QuickViewHost({ routeKey = null }) {
  const quickView = useSyncExternalStore(quickViewStore.subscribe, quickViewStore.get);
  const shownRef = useRef(null);

  const isShown = !!quickView && quickView.routeKey === routeKey;
  // The last photo shown stays while the view fades out.
  if (isShown) shownRef.current = quickView.asset;
  const asset = isShown ? quickView.asset : shownRef.current;

  return (
    <FadeView isVisible={isShown} pointerEvents="auto" style={styles.overlay}>
      {asset && (
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
      )}
    </FadeView>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 9999,
  },
  container: {
    flex: 1,
    paddingVertical: 50,
    paddingHorizontal: 20,
  },
});
