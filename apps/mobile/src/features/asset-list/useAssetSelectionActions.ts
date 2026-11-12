import { router } from 'expo-router';

import type { AssetSelection } from '@/features/asset-list/actions/toggle-select-assets-action/useToggleSelectAssetsAction';
import assetHref from '@/features/asset-list/assetHref';
import type { AssetQuery } from '@/features/asset-list/assetQuery';
import { getDb, schema } from '@/sync/db/client';
import type { AssetRow } from '@/sync/db/schema';
import { readByIds } from '@/sync/readByIds';
import useShareAssets from '@/utils/assets/useShareAssets';

// What an asset grid with select mode does with a tap and with the selection. `selection` comes from
// useToggleSelectAssetsAction; `query` is the grid's assetQuery and `count` how many assets it shows.
export default function useAssetSelectionActions(
  selection: AssetSelection,
  query: AssetQuery,
  count: number | undefined,
) {
  const { isSelectMode, selectedAssetIds, toggleSelectAsset, selectAssets, exitSelectMode } = selection;
  const shareAssetsAsync = useShareAssets();

  const allSelected = count !== undefined && count > 0 && selectedAssetIds.length === count;

  return {
    hasSelection: selectedAssetIds.length > 0,
    allSelected,
    openAsset(asset: Pick<AssetRow, 'id'>) {
      if (isSelectMode) toggleSelectAsset(asset.id);
      else router.navigate(assetHref(asset.id, query.descriptor));
    },
    // Exactly what the grid shows, however many: the count and the selection always agree.
    async toggleSelectAll() {
      selectAssets(allSelected ? [] : await query.ids(getDb()));
    },
    async shareSelected() {
      await shareAssetsAsync(await readByIds(getDb(), schema.assets, selectedAssetIds));
    },
    addSelectedToAlbum() {
      router.navigate({ pathname: '/add-to-album', params: { assetIds: selectedAssetIds.join(',') } });
      exitSelectMode();
    },
    postSelected() {
      router.navigate({ pathname: '/post-editor', params: { assetIds: selectedAssetIds.join(',') } });
      exitSelectMode();
    },
  };
}
