import { Children, cloneElement } from 'react';

import PopupMenu from '@/components/popup-menu-options/PopupMenu';
import useAssets from '@/features/assets-context/useAssets';
import getAssetsByIds from '@/utils/assets/queries/getAssetsByIds';

const allAssetsLimit = 500;

export default function SelectionActionsMenu({ selectedAssetIds, allAssetIds, children }) {
  const { assets } = useAssets();

  const resolvedIds =
    selectedAssetIds.length > 0 || allAssetIds.length > allAssetsLimit ? selectedAssetIds : allAssetIds;

  function getSelectedAssets() {
    return getAssetsByIds(assets, resolvedIds);
  }

  const childrenWithProps = Children.map(children, (child) =>
    child ? cloneElement(child, { getSelectedAssets }) : child,
  );

  return <PopupMenu icon="menu">{childrenWithProps}</PopupMenu>;
}
