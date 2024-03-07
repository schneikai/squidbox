import { View, Text } from 'react-native';

import SelectedAssetsProvider from './SelectedAssetsProvider';

import selectedAssetsToolBarStyles from '@/styles/selectedAssetsToolBarStyles';
import pluralizeText from '@/utils/pluralizeText';

export default function SelectedAssetsToolBar({ selectedAssetIds, allAssetIds, children }) {
  let assetIds = [];
  let title = 'Selected';
  const allAssetsLimit = 500;

  if (selectedAssetIds.length > 0 || allAssetIds.length > allAssetsLimit) {
    assetIds = selectedAssetIds;
    title = `${assetIds.length} selected`;
  } else {
    assetIds = allAssetIds;
    title = pluralizeText('1 asset', '%{count} assets', assetIds.length);
  }

  return (
    <SelectedAssetsProvider selectedAssetIds={assetIds}>
      <View style={selectedAssetsToolBarStyles.container}>
        <View style={selectedAssetsToolBarStyles.toolBar}>
          <Text style={selectedAssetsToolBarStyles.infoText}>{title}</Text>
          <View style={selectedAssetsToolBarStyles.toolBarButtons}>{children}</View>
        </View>
      </View>
    </SelectedAssetsProvider>
  );
}
