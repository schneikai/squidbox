import { memo, useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated from 'react-native-reanimated';

import useZoomGesture from './useZoomGesture';

import AssetImage from '@/components/AssetImage';

// Memoized: the pager re-renders on every swipe, its pages shouldn't.
export default memo(AssetItem);

// An asset filling `style`, zoomable while `isZoomable` (see useZoomGesture). `onZoomChange(assetId,
// isZoomed)` lets a pager lock its swipe while this asset is zoomed in.
function AssetItem({ asset, style, isZoomable, onTap, onZoomChange }) {
  const assetId = asset?.id;
  const handleZoomChange = useCallback((isZoomed) => onZoomChange?.(assetId, isZoomed), [assetId, onZoomChange]);
  const { gesture, zoomStyle, onLayout } = useZoomGesture({
    aspectRatio: asset?.width / asset?.height,
    isZoomable,
    onTap,
    onZoomChange: handleZoomChange,
  });

  return (
    <GestureDetector gesture={gesture}>
      <View style={[styles.container, style]} onLayout={onLayout}>
        <Animated.View style={[styles.image, zoomStyle]}>
          <AssetImage asset={asset} contentFit="contain" placeholderColor="transparent" />
        </Animated.View>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  // A zoomed image stays inside its page.
  container: {
    overflow: 'hidden',
  },
  image: {
    flex: 1,
  },
});
