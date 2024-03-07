import { useFocusEffect } from '@react-navigation/native';
import { useState, useEffect, useCallback } from 'react';

import AssetQuickViewModal, { useAssetQuickViewModal } from '@/components/AssetQuickViewModal';
import HeaderActions from '@/components/HeaderActions';
import SuperPressable from '@/components/SuperPressable';
import ScreenHeaderWithBackButton from '@/components/screen-header/ScreenHeaderWithBackButton';
import useAlbums from '@/features/albums-context/useAlbums';
import AssetList from '@/features/asset-list/AssetList';
import AssetListItem from '@/features/asset-list/AssetListItem';
import FilterAssetsAction from '@/features/asset-list/actions/filter-assets-action/FilterAssetsAction';
import useFilterAssetsAction from '@/features/asset-list/actions/filter-assets-action/useFilterAssetsAction';
import SortAssetsAction from '@/features/asset-list/actions/sort-assets-action/SortAssetsAction';
import useSortAssetsAction from '@/features/asset-list/actions/sort-assets-action/useSortAssetsAction';
import prepareAssets from '@/features/asset-list/prepareAssets';
import useAssetList from '@/features/asset-list/useAssetList';
import useAssetPicker from '@/features/asset-picker/useAssetPicker';
import useAssets from '@/features/assets-context/useAssets';

export default function AlbumScreen({ route, navigation }) {
  const { albumId } = route.params;
  const { assets, toggleFavoriteAsset } = useAssets();
  const { albums } = useAlbums();

  const { toggleSelectAsset, isAssetSelected, setAlbumScreenProps } = useAssetPicker();
  const [album] = useState(albums[albumId]);

  const [assetIds, setAssetIds] = useState();
  const { listRef, listScrollTop } = useAssetList();
  const { sortOrder, sortFunction, sortAssets } = useSortAssetsAction({ afterSort: listScrollTop });
  const { activeFilter, toggleFilter, matchFilter } = useFilterAssetsAction({ afterFilter: listScrollTop });
  const { asset: quickViewAsset, open: openAssetQuickView, close: closeAssetQuickView } = useAssetQuickViewModal();

  useFocusEffect(
    useCallback(() => {
      setAlbumScreenProps({ album, navigation });
      return () => {
        setAlbumScreenProps(null);
      };
    }, [navigation]),
  );

  useEffect(() => {
    const albumAssets = album.assets.map((assetId) => assets[assetId]);
    const assetIds = prepareAssets({ assets: albumAssets, sortFn: sortFunction, filterFn: matchFilter }).map(
      (asset) => asset.id,
    );
    setAssetIds(assetIds);
  }, [album, assets, sortOrder, activeFilter]);

  return (
    <>
      <AssetQuickViewModal asset={quickViewAsset} isVisible={!!quickViewAsset} />
      <AssetList
        listRef={listRef}
        assetIds={assetIds}
        renderListItem={(asset) => (
          <SuperPressable
            onPress={() => toggleSelectAsset(asset)}
            onDoublePress={() => toggleFavoriteAsset(asset)}
            onLongPress={() => openAssetQuickView(asset)}
            onLongPressOut={() => closeAssetQuickView()}
            style={{ flex: 1 }}
          >
            <AssetListItem
              asset={asset}
              isSelected={isAssetSelected(asset)}
              showLastPostedAt={sortOrder.includes('lastPostedAt')}
            />
          </SuperPressable>
        )}
        ListHeaderComponent={
          <ScreenHeaderWithBackButton label={album.name} onPressBack={() => navigation.goBack()}>
            <HeaderActions>
              <SortAssetsAction sortOrder={sortOrder} onPress={sortAssets} />
              <FilterAssetsAction activeFilter={activeFilter} onPress={toggleFilter} />
            </HeaderActions>
          </ScreenHeaderWithBackButton>
        }
      />
    </>
  );
}
