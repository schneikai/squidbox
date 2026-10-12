import { useEffect, useRef, useState } from 'react';
import { FlatList, useWindowDimensions } from 'react-native';

import AssetItem from './AssetItem';

import useAssets from '@/features/assets-context/useAssets';

/**
 * Horizontally paged, controlled list of assets: it shows `currentAssetId` and reports the page
 * the user settles on through `onChangeAssetId`.
 */
export default function AssetPager({ assetIds, currentAssetId, onChangeAssetId, onTapAsset }) {
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
  function handleScrollEnd(event) {
    const index = Math.round(event.nativeEvent.contentOffset.x / pageWidth);
    const assetId = assetIds[index];
    if (!assetId) return;
    shownIndexRef.current = index;
    onChangeAssetId(assetId);
  }

  return (
    <FlatList
      ref={listRef}
      data={assetIds}
      keyExtractor={(assetId) => assetId}
      renderItem={({ item: assetId }) => (
        <AssetItem asset={assets[assetId]} style={{ width: pageWidth, height: pageHeight }} onTap={onTapAsset} />
      )}
      getItemLayout={(_, index) => ({ length: pageWidth, offset: pageWidth * index, index })}
      initialScrollIndex={initialScrollIndex}
      horizontal
      pagingEnabled
      bounces={false}
      showsHorizontalScrollIndicator={false}
      onScrollEndDrag={handleScrollEnd}
      onMomentumScrollEnd={handleScrollEnd}
      onLayout={(event) => setPageHeight(event.nativeEvent.layout.height)}
    />
  );
}
