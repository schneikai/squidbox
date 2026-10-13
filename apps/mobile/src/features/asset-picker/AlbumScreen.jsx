import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useMemo } from 'react';

import AssetQuickViewModal, { useAssetQuickViewModal } from '@/components/AssetQuickViewModal';
import PickerHeader from '@/components/PickerHeader';
import useAlbums from '@/features/albums-context/useAlbums';
import AssetList from '@/features/asset-list/AssetList';
import FilterAssetsAction from '@/features/asset-list/actions/filter-assets-action/FilterAssetsAction';
import useFilterAssetsAction from '@/features/asset-list/actions/filter-assets-action/useFilterAssetsAction';
import SortAssetsAction from '@/features/asset-list/actions/sort-assets-action/SortAssetsAction';
import useSortAssetsAction from '@/features/asset-list/actions/sort-assets-action/useSortAssetsAction';
import prepareAssets from '@/features/asset-list/prepareAssets';
import useAssetCells from '@/features/asset-list/useAssetCells';
import useAssetList from '@/features/asset-list/useAssetList';
import useAssetPicker from '@/features/asset-picker/useAssetPicker';
import useAssets from '@/features/assets-context/useAssets';
import getAlbumAssets from '@/utils/albums/getAlbumAssets';

export default function AlbumScreen({ route, navigation }) {
  const { albumId } = route.params;
  const { assets, toggleFavoriteAsset } = useAssets();
  const { albums } = useAlbums();

  const { toggleSelectAsset, isAssetSelected, setAlbumScreenProps } = useAssetPicker();
  const album = albums[albumId];

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

  const assetIds = useMemo(
    () =>
      prepareAssets({
        assets: album ? getAlbumAssets(album, assets) : [],
        sortFn: sortFunction,
        filterFn: matchFilter,
      }).map((asset) => asset.id),
    [album, assets, sortFunction, matchFilter],
  );

  const renderCell = useAssetCells({
    isAssetSelected,
    showLastPostedAt: sortOrder.includes('lastPostedAt'),
    onPress: toggleSelectAsset,
    onDoublePress: toggleFavoriteAsset,
    onLongPress: openAssetQuickView,
    onLongPressOut: closeAssetQuickView,
  });

  if (!album) return null;

  return (
    <>
      <AssetQuickViewModal asset={quickViewAsset} isVisible={!!quickViewAsset} />
      <AssetList
        listRef={listRef}
        assetIds={assetIds}
        renderListItem={renderCell}
        ListHeaderComponent={
          <PickerHeader label={album.name}>
            <SortAssetsAction sortOrder={sortOrder} onPress={sortAssets} />
            <FilterAssetsAction activeFilter={activeFilter} onPress={toggleFilter} />
          </PickerHeader>
        }
      />
    </>
  );
}
