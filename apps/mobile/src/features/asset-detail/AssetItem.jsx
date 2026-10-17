import { memo, useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated from 'react-native-reanimated';

import AssetVideo from './AssetVideo';
import useZoomGesture from './useZoomGesture';

import AssetImage from '@/components/AssetImage';
import { MEDIA_TYPES } from '@/utils/assets/constants';

// Memoized: the pager re-renders on every swipe, its pages shouldn't.
export default memo(AssetItem);

// An asset filling `style`, zoomable while `isZoomable` (see useZoomGesture), unless it's a video.
// `onZoomChange(assetId, isZoomed)` lets a pager lock its swipe while this asset is zoomed in;
// `video` (useAssetVideo's) plays over the thumbnail; `verticalDrag`: see useZoomGesture.
function AssetItem({ asset, style, isZoomable, onTap, onZoomChange, video, verticalDrag }) {
  const assetId = asset?.id;
  const handleZoomChange = useCallback((isZoomed) => onZoomChange?.(assetId, isZoomed), [assetId, onZoomChange]);
  const { gesture, zoomStyle, onLayout } = useZoomGesture({
    aspectRatio: asset?.width / asset?.height,
    isZoomable: isZoomable && asset?.mediaType !== MEDIA_TYPES.VIDEO,
    onTap,
    onZoomChange: handleZoomChange,
    verticalDrag,
  });

  return (
    <GestureDetector gesture={gesture}>
      <View style={[styles.container, style]} onLayout={onLayout}>
        <Animated.View style={[styles.image, zoomStyle]}>
          <AssetImage
            asset={asset}
            contentFit="contain"
            placeholderColor="transparent"
            // AssetVideo says itself why the current video can't play.
            showNotUploaded={!video}
          />
        </Animated.View>
        {video && <AssetVideo key={video.key} video={video} />}
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
