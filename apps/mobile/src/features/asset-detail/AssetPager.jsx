import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, useWindowDimensions } from 'react-native';

import AssetItem from './AssetItem';

import useAssets from '@/features/assets-context/useAssets';

const keyExtractor = (assetId) => assetId;

/**
 * Horizontally paged, controlled list of assets: it shows `currentAssetId` and reports the page
 * the user settles on through `onChangeAssetId`. Memoized with stable list props, so a swipe
 * re-renders the pager but not its pages.
 */
export default memo(AssetPager);

function AssetPager({ assetIds, currentAssetId, onChangeAssetId, onTapAsset }) {
  const { assets } = useAssets();
  const { width: pageWidth } = useWindowDimensions();
  // Pages take the pager's height explicitly: native stretches list items to it, the web doesn't.
  const [pageHeight, setPageHeight] = useState(0);
  const listRef = useRef(null);
  const currentIndex = assetIds.indexOf(currentAssetId);
  const [initialScrollIndex] = useState(Math.max(currentIndex, 0));
  const shownIndexRef = useRef(initialScrollIndex);

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
  const pageStyle = useMemo(() => ({ width: pageWidth, height: pageHeight }), [pageWidth, pageHeight]);
  const renderItem = useCallback(
    ({ item: assetId }) => <AssetItem asset={assets[assetId]} style={pageStyle} onTap={onTapAsset} />,
    [assets, pageStyle, onTapAsset],
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
      bounces={false}
      showsHorizontalScrollIndicator={false}
      onScrollEndDrag={handleScrollEnd}
      onMomentumScrollEnd={handleScrollEnd}
      onLayout={handleLayout}
    />
  );
}
