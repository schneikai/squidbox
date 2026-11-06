import { memo, useCallback } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated from 'react-native-reanimated';

import AssetMessage, { type AssetMessageText } from './AssetMessage';
import AssetVideo from './AssetVideo';
import aspectRatioOf from './aspectRatioOf';
import unavailableMessage from './unavailableMessage';
import type { AssetVideo as AssetVideoValue } from './useAssetVideo';
import useZoomGesture, { type UseZoomGestureOptions } from './useZoomGesture';

import AssetImage, { type ThumbnailStatus } from '@/components/AssetImage';
import type { AssetRow } from '@/sync/db/schema';
import { MEDIA_TYPES } from '@/utils/assets/constants';

// Memoized: the pager re-renders on every swipe, its pages shouldn't.
export default memo(AssetItem);

export type AssetItemProps = {
  asset?: AssetRow;
  style: StyleProp<ViewStyle>;
  isZoomable?: boolean;
  onTap: () => void;
  onZoomChange?: (assetId: string, isZoomed: boolean) => void;
  video?: AssetVideoValue | null;
} & Pick<UseZoomGestureOptions, 'verticalDrag' | 'pagerGesture' | 'edgeSwipe'>;

// An asset filling `style`, zoomable while `isZoomable` (see useZoomGesture), unless it's a video.
// `onZoomChange(assetId, isZoomed)` lets a pager lock its swipe while this asset is zoomed in;
// `video` (useAssetVideo's) plays over the thumbnail; `verticalDrag`, `pagerGesture` and
// `edgeSwipe`: see useZoomGesture.
function AssetItem({
  asset,
  style,
  isZoomable,
  onTap,
  onZoomChange,
  video,
  verticalDrag,
  pagerGesture,
  edgeSwipe,
}: AssetItemProps) {
  const assetId = asset?.id;
  const canZoom = asset?.mediaType !== MEDIA_TYPES.VIDEO;
  // A blank page (no asset) has nothing to report.
  const handleZoomChange = useCallback(
    (isZoomed: boolean) => {
      if (assetId !== undefined) onZoomChange?.(assetId, isZoomed);
    },
    [assetId, onZoomChange],
  );
  const { gesture, zoomStyle, onLayout } = useZoomGesture({
    aspectRatio: aspectRatioOf(asset),
    canZoom,
    isZoomable: isZoomable && canZoom,
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

const FAILED_MESSAGE: AssetMessageText = { icon: 'alert', text: "Couldn't load this photo." };

// A photo its device hasn't backed up yet, one only in the cloud while signed out, or one whose
// download gave up.
function renderUnavailable(hasPicture: boolean, status: ThumbnailStatus | undefined) {
  const message = unavailableMessage(status) ?? (status === 'failed' ? FAILED_MESSAGE : undefined);
  if (hasPicture || !message) return null;
  return (
    <View style={[StyleSheet.absoluteFill, styles.overlay]}>
      <AssetMessage message={message} />
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
