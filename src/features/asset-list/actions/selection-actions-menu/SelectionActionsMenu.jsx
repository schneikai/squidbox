import Ionicons from '@expo/vector-icons/Ionicons';
import { Children, cloneElement } from 'react';
import { Menu, MenuOptions, MenuTrigger } from 'react-native-popup-menu';

import useAssets from '@/features/assets-context/useAssets';
import headerActionStyles from '@/styles/headerActionStyles';
import popupMenuStyles from '@/styles/popupMenuStyles';

const allAssetsLimit = 500;

export default function SelectionActionsMenu({ selectedAssetIds, allAssetIds, children }) {
  const { assets } = useAssets();

  const resolvedIds =
    selectedAssetIds.length > 0 || allAssetIds.length > allAssetsLimit
      ? selectedAssetIds
      : allAssetIds;

  function getSelectedAssets() {
    return Object.values(assets).filter((asset) => resolvedIds.includes(asset.id));
  }

  const childrenWithProps = Children.map(children, (child) =>
    child ? cloneElement(child, { getSelectedAssets }) : child,
  );

  return (
    <Menu>
      <MenuTrigger customStyles={{ triggerWrapper: headerActionStyles.button }}>
        <Ionicons name="ellipsis-vertical" style={headerActionStyles.buttonIcon} />
      </MenuTrigger>
      <MenuOptions customStyles={popupMenuStyles.menuOptions}>{childrenWithProps}</MenuOptions>
    </Menu>
  );
}
