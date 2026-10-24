import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, useWindowDimensions } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedRef } from 'react-native-reanimated';

import AssetPage from './AssetPage';
import usePagerEdgeSwipe from './usePagerEdgeSwipe';

const keyExtractor = (assetId) => assetId;
const isWeb = Platform.OS === 'web';

// A page that zooms out clears the slot only if it still holds that page.
function nextZoomedAssetId({ zoomed, assetId, isZoomed }) {
  if (isZoomed) return assetId;
  return zoomed === assetId ? null : zoomed;
}

/**
 * Horizontally paged, controlled list of assets: it shows `currentAssetId` and reports the page
 * the user settles on through `onChangeAssetId`. `assetsById` holds the rows around the current one
 * (the screen's window); a page outside it is blank, never visible with paging. Memoized with
 * stable list props, so a swipe re-renders the pager and only the two pages it moves between. Only
 * the current page is zoomable and shows `video`. While it is zoomed in, its pan owns the swipe:
 * natively it hands the overshoot at the image's edge to the pager (usePagerEdgeSwipe), which
 * follows the finger to the next page; the web locks the pager instead. `onLockChange(isLocked)`
 * reports the zoom so the screen can lock its swipe-back too.
 * Each page shows its asset with its details panel (AssetPage, on `panel`'s track, useDetailsPanel):
 * while `isDetailsShown`, the current page and its neighbours mount their details. The list is
 * `panel.pagerGesture`, which the pages' vertical drags hold while they run.
 */
export default memo(AssetPager);

function AssetPager({
  assetIds,
  assetsById,
  currentAssetId,
  video,
  panel,
  isDetailsShown,
  onChangeAssetId,
  onTapAsset,
  onLockChange,
}) {
  const { width: pageWidth } = useWindowDimensions();
  // Pages take the pager's height explicitly: native stretches list items to it, the web doesn't.
  const [pageHeight, setPageHeight] = useState(0);
  const listRef = useAnimatedRef();
  const currentIndex = assetIds.indexOf(currentAssetId);
  const pageIndex = Math.max(currentIndex, 0);
  const [initialScrollIndex] = useState(pageIndex);
  const shownIndexRef = useRef(initialScrollIndex);
  const [zoomedAssetId, setZoomedAssetId] = useState(null);
  // Only the current asset can be zoomed, so the pager unlocks once it stops being current.
  const isLocked = !!zoomedAssetId && zoomedAssetId === currentAssetId;
  // Natively the zoomed pan owns the swipe on the UI thread (useZoomGesture) and at the image's edge
  // hands the overshoot to the list through `edgeSwipe`; a lock by render would lag under JS load.
  // The web's gestures can't hold a scroll view, so the web locks the list instead.
  const isScrollLocked = isLocked && isWeb;

  // A page the list settled on, by a swipe or a zoomed photo's edge swipe.
  const showIndex = useCallback(
    (index) => {
      const assetId = assetIds[index];
      if (!assetId) return;
      shownIndexRef.current = index;
      onChangeAssetId(assetId);
    },
    [assetIds, onChangeAssetId],
  );
  const { edgeSwipe, onListDragStart } = usePagerEdgeSwipe({
    listRef,
    pageWidth,
    pageIndex,
    pageCount: assetIds.length,
    onPage: showIndex,
  });
  // Not while the current asset is missing from the list (removed, the screen yet to move on): the
  // pager wouldn't know which page it is on.
  const pageEdgeSwipe = isWeb || currentIndex < 0 ? null : edgeSwipe;

  // Only changes are reported: the pager starts unlocked.
  const reportedLockRef = useRef(false);

  useEffect(() => {
    if (isLocked === reportedLockRef.current) return;
    reportedLockRef.current = isLocked;
    onLockChange(isLocked);
  }, [isLocked, onLockChange]);

  // Follow the current asset when it moves without a swipe, e.g. when an asset before it is deleted.
  useEffect(() => {
    if (currentIndex < 0 || currentIndex === shownIndexRef.current) return;
    shownIndexRef.current = currentIndex;
    listRef.current?.scrollToIndex({ index: currentIndex, animated: false });
  }, [currentIndex]);

  // Both end events are handled: a drag released exactly on a page boundary has no momentum phase.
  const handleScrollEnd = useCallback(
    (event) => showIndex(Math.round(event.nativeEvent.contentOffset.x / pageWidth)),
    [pageWidth, showIndex],
  );
  const handleZoomChange = useCallback(
    (assetId, isZoomed) => setZoomedAssetId((zoomed) => nextZoomedAssetId({ zoomed, assetId, isZoomed })),
    [],
  );
  const pageStyle = useMemo(() => ({ width: pageWidth, height: pageHeight }), [pageWidth, pageHeight]);
  const renderItem = useCallback(
    ({ item: assetId, index }) => (
      <AssetPage
        asset={assetsById.get(assetId)}
        style={pageStyle}
        isCurrent={assetId === currentAssetId}
        showsDetails={isDetailsShown && Math.abs(index - currentIndex) <= 1}
        panel={panel}
        onTap={onTapAsset}
        onZoomChange={handleZoomChange}
        video={assetId === currentAssetId ? video : null}
        edgeSwipe={pageEdgeSwipe}
      />
    ),
    [
      assetsById,
      pageStyle,
      currentAssetId,
      currentIndex,
      isDetailsShown,
      video,
      panel,
      pageEdgeSwipe,
      onTapAsset,
      handleZoomChange,
    ],
  );
  const getItemLayout = useCallback(
    (_, index) => ({ length: pageWidth, offset: pageWidth * index, index }),
    [pageWidth],
  );
  const handleLayout = useCallback((event) => setPageHeight(event.nativeEvent.layout.height), []);

  return (
    <GestureDetector gesture={panel.pagerGesture}>
      <Animated.FlatList
        ref={listRef}
        data={assetIds}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        getItemLayout={getItemLayout}
        initialScrollIndex={initialScrollIndex}
        horizontal
        pagingEnabled
        scrollEnabled={!isScrollLocked}
        // Pages follow the panel's drag frame by frame: keep only the current one and its neighbours.
        windowSize={3}
        bounces={false}
        showsHorizontalScrollIndicator={false}
        // The list's own drag takes over from a zoomed photo's running edge-swipe snap.
        onScrollBeginDrag={isWeb ? undefined : onListDragStart}
        onScrollEndDrag={handleScrollEnd}
        onMomentumScrollEnd={handleScrollEnd}
        onLayout={handleLayout}
      />
    </GestureDetector>
  );
}
