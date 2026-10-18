import { memo, useCallback, useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { clamp, useAnimatedStyle } from 'react-native-reanimated';

import AssetItem from './AssetItem';
import AssetDetailsPanel from './details/AssetDetailsPanel';
import getDetailsMediaCover from './details/getDetailsMediaCover';

// Memoized: the pager re-renders on every swipe, its pages shouldn't.
export default memo(AssetPage);

/**
 * One page of the asset pager: the asset (AssetItem) and, with `showsDetails`, its details panel
 * below it, so a swipe anywhere on the page moves both. Every page follows `panel`'s one track
 * (useDetailsPanel); the current page (`isCurrent`) reports its details' height and starts them at
 * their top. The other props go to AssetItem.
 */
function AssetPage({ asset, style, isCurrent, showsDetails, panel, navigation, video, onTap, onZoomChange }) {
  const contentHeightRef = useRef(0);
  const { mediaStyle, panelStyle, contentStyle } = usePageStyles(panel, asset?.width / asset?.height);
  const { contentHeight, showFromTop } = panel;

  useEffect(() => {
    if (!showsDetails) contentHeightRef.current = 0;
    if (!isCurrent) return;
    contentHeight.value = contentHeightRef.current;
    showFromTop();
  }, [isCurrent, showsDetails, contentHeight, showFromTop]);

  const handleContentLayout = useCallback(
    (event) => {
      contentHeightRef.current = event.nativeEvent.layout.height;
      if (isCurrent) contentHeight.value = contentHeightRef.current;
    },
    [isCurrent, contentHeight],
  );

  return (
    <View style={[styles.page, style]}>
      <Animated.View style={[StyleSheet.absoluteFill, mediaStyle]}>
        <AssetItem
          asset={asset}
          style={StyleSheet.absoluteFill}
          isZoomable={isCurrent}
          onTap={onTap}
          onZoomChange={onZoomChange}
          video={video}
          verticalDrag={panel.verticalDrag}
          pagerGesture={panel.pagerGesture}
        />
      </Animated.View>
      {showsDetails && asset && (
        <AssetDetailsPanel
          asset={asset}
          isCurrent={isCurrent}
          navigation={navigation}
          verticalDrag={panel.verticalDrag}
          pagerGesture={panel.pagerGesture}
          style={[styles.panel, panelStyle]}
          contentStyle={isCurrent && contentStyle}
          onContentLayout={handleContentLayout}
          onEditingBottomChange={panel.setEditingBottom}
        />
      )}
    </View>
  );
}

// The page's share of the track: its photo moves up and grows until it covers the band above the
// open panel (getDetailsMediaCover, from this page's own `aspectRatio`, so a page swiped in is
// already in place); the panel comes in from below, as tall as it is open; the details scroll
// within it past that.
function usePageStyles({ offset, openAt, page }, aspectRatio) {
  const mediaStyle = useAnimatedStyle(() => {
    const open = openAt.value;
    const progress = open > 0 ? clamp(offset.value / open, 0, 1) : 0;
    const { width, height } = page.value;
    const cover = getDetailsMediaCover({ width, height, aspectRatio, bandHeight: height - open });
    return {
      transform: [{ translateY: progress * cover.translateY }, { scale: 1 + progress * (cover.scale - 1) }],
    };
  }, [aspectRatio]);
  const panelStyle = useAnimatedStyle(() => ({
    height: openAt.value,
    transform: [{ translateY: openAt.value - Math.min(offset.value, openAt.value) }],
  }));
  const contentStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -Math.max(offset.value - openAt.value, 0) }],
  }));
  return { mediaStyle, panelStyle, contentStyle };
}

const styles = StyleSheet.create({
  // The photo, grown to cover the band above the panel, stays within its page.
  page: {
    overflow: 'hidden',
  },
  panel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
});
