import { BlurView } from 'expo-blur';
import { use, useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import quickViewStore from './quickViewStore';

import AssetImage from '@/components/AssetImage';
import FadeView from '@/components/FadeView';
import SheetRouteContext from '@/components/sheet-route/SheetRouteContext';
import { motion } from '@/styles/designTokens';

/**
 * The quick view (a long-press peek at a photo) over the whole surface: one host at the app root and
 * one in each sheet (SheetRoute), each showing the peeks opened in its surface. Rendered in-tree,
 * never in a native Modal: a Modal takes the touch away from the cell or grid gesture that opened
 * the peek, and that touch's release is what closes it. A tap closes it too, should a release ever
 * be missed.
 */
export default function QuickViewHost() {
  const routeKey = use(SheetRouteContext)?.routeKey ?? null;
  const getShown = useCallback(() => {
    const quickView = quickViewStore.get();
    return quickView?.routeKey === routeKey ? quickView : null;
  }, [routeKey]);
  const shown = useSyncExternalStore(quickViewStore.subscribe, getShown);
  // The photo stays while the view fades out, and goes once it has.
  const [keptAsset, setKeptAsset] = useState(null);
  if (shown && shown.asset !== keptAsset) setKeptAsset(shown.asset);

  useEffect(() => {
    if (shown || !keptAsset) return;
    const timer = setTimeout(() => setKeptAsset(null), motion.exit.duration);
    return () => clearTimeout(timer);
  }, [shown, keptAsset]);

  const asset = shown?.asset ?? keptAsset;

  function handleClose() {
    quickViewStore.close(shown?.owner);
  }

  return (
    <FadeView isVisible={!!shown} style={styles.overlay}>
      {asset && (
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={handleClose}
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
