import { memo, useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated from 'react-native-reanimated';

import AssetMessage from './AssetMessage';
import AssetVideo from './AssetVideo';
import useZoomGesture from './useZoomGesture';

import AssetImage from '@/components/AssetImage';
import { MEDIA_TYPES } from '@/utils/assets/constants';
import assetFileUnavailableMessages from '@/utils/assets/files/assetFileUnavailableMessages';

// Memoized: the pager re-renders on every swipe, its pages shouldn't.
export default memo(AssetItem);

// An asset filling `style`, zoomable while `isZoomable` (see useZoomGesture), unless it's a video.
// `onZoomChange(assetId, isZoomed)` lets a pager lock its swipe while this asset is zoomed in;
// `video` (useAssetVideo's) plays over the thumbnail; `verticalDrag`, `pagerGesture` and
// `edgeSwipe`: see useZoomGesture.
function AssetItem({ asset, style, isZoomable, onTap, onZoomChange, video, verticalDrag, pagerGesture, edgeSwipe }) {
  const assetId = asset?.id;
  const handleZoomChange = useCallback((isZoomed) => onZoomChange?.(assetId, isZoomed), [assetId, onZoomChange]);
  const { gesture, zoomStyle, onLayout } = useZoomGesture({
    aspectRatio: asset?.width / asset?.height,
    isZoomable: isZoomable && asset?.mediaType !== MEDIA_TYPES.VIDEO,
    onTap,
    onZoomChange: handleZoomChange,
    verticalDrag,
    pagerGesture,
    edgeSwipe,
  });

  return (
    <GestureDetector gesture={gesture}>
      <View style={[styles.container, style]} onLayout={onLayout}>
        <Animated.View style={[styles.image, zoomStyle]}>
          <AssetImage
            asset={asset}
            contentFit="contain"
            placeholderColor="transparent"
            // The page says in words why there's no picture; AssetVideo does for the current video.
            showNotUploaded={false}
            renderOverlay={video ? undefined : renderUnavailable}
          />
        </Animated.View>
        {video && <AssetVideo key={video.key} video={video} />}
      </View>
    </GestureDetector>
  );
}

// A photo its device hasn't backed up yet, or one only in the cloud while signed out.
function renderUnavailable(hasPicture, status) {
  const unavailable = assetFileUnavailableMessages[status];
  if (hasPicture || !unavailable) return null;
  return (
    <View style={[StyleSheet.absoluteFill, styles.overlay]}>
      <AssetMessage message={{ icon: unavailable.icon, text: unavailable.message }} />
    </View>
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
  overlay: {
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'none',
  },
});
