import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, useWindowDimensions } from 'react-native';

import AssetItem from './AssetItem';

const keyExtractor = (assetId) => assetId;

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
 * the current page is zoomable and shows `video`. While it is zoomed in, its pan owns the swipe: the
 * pager is locked, and `onLockChange(isLocked)` reports it so the screen can lock its swipe-back too.
 * `verticalDrag` goes to every page (see useZoomGesture); `isPagingLocked` locks the pager too.
 */
export default memo(AssetPager);

function AssetPager({
  assetIds,
  assetsById,
  currentAssetId,
  video,
  verticalDrag,
  isPagingLocked,
  onChangeAssetId,
  onTapAsset,
  onLockChange,
}) {
  const { width: pageWidth } = useWindowDimensions();
  // Pages take the pager's height explicitly: native stretches list items to it, the web doesn't.
  const [pageHeight, setPageHeight] = useState(0);
  const listRef = useRef(null);
  const currentIndex = assetIds.indexOf(currentAssetId);
  const [initialScrollIndex] = useState(Math.max(currentIndex, 0));
  const shownIndexRef = useRef(initialScrollIndex);
  const [zoomedAssetId, setZoomedAssetId] = useState(null);
  // Only the current asset can be zoomed, so the pager unlocks once it stops being current.
  const isLocked = !!zoomedAssetId && zoomedAssetId === currentAssetId;

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
    (event) => {
      const index = Math.round(event.nativeEvent.contentOffset.x / pageWidth);
      const assetId = assetIds[index];
      if (!assetId) return;
      shownIndexRef.current = index;
      onChangeAssetId(assetId);
    },
    [assetIds, pageWidth, onChangeAssetId],
  );
  const handleZoomChange = useCallback(
    (assetId, isZoomed) => setZoomedAssetId((zoomed) => nextZoomedAssetId({ zoomed, assetId, isZoomed })),
    [],
  );
  const pageStyle = useMemo(() => ({ width: pageWidth, height: pageHeight }), [pageWidth, pageHeight]);
  const renderItem = useCallback(
    ({ item: assetId }) => (
      <AssetItem
        asset={assetsById.get(assetId)}
        style={pageStyle}
        isZoomable={assetId === currentAssetId}
        onTap={onTapAsset}
        onZoomChange={handleZoomChange}
        video={assetId === currentAssetId ? video : null}
        verticalDrag={verticalDrag}
      />
    ),
    [assetsById, pageStyle, currentAssetId, video, verticalDrag, onTapAsset, handleZoomChange],
  );
  const getItemLayout = useCallback(
    (_, index) => ({ length: pageWidth, offset: pageWidth * index, index }),
    [pageWidth],
  );
  const handleLayout = useCallback((event) => setPageHeight(event.nativeEvent.layout.height), []);

  return (
    <FlatList
      ref={listRef}
      data={assetIds}
      keyExtractor={keyExtractor}
      renderItem={renderItem}
      getItemLayout={getItemLayout}
      initialScrollIndex={initialScrollIndex}
      horizontal
      pagingEnabled
      scrollEnabled={!isLocked && !isPagingLocked}
      bounces={false}
      showsHorizontalScrollIndicator={false}
      onScrollEndDrag={handleScrollEnd}
      onMomentumScrollEnd={handleScrollEnd}
      onLayout={handleLayout}
    />
  );
}
