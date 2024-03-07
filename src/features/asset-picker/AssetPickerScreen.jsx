import { useCallback, useEffect, useState } from 'react';
import { Button } from 'react-native';

import PillButton from '@/components/PillButton';
import AddAssetsButton from '@/features/asset-picker/AddAssetsButton';
import AssetPickerStackNavigator from '@/features/asset-picker/AssetPickerStackNavigator';
import useAssetPicker from '@/features/asset-picker/useAssetPicker';

export default function AssetPickerScreen({ navigation }) {
  const { selectedAssets, albumScreenProps, onConfirmSelection, onCancelSelection } = useAssetPicker();
  const [activeNavigationItem, setActiveNavigationItem] = useState('Assets');

  const confirmSelection = useCallback(() => {
    onConfirmSelection();
    navigation.goBack();
  });

  const cancelSelection = useCallback(() => {
    onCancelSelection();
    navigation.goBack();
  });

  const navigateTo = useCallback((to) => {
    setActiveNavigationItem(to);
    navigation.navigate(to);
  });

  useEffect(() => {
    if (albumScreenProps?.navigation) {
      navigation.setOptions({
        headerLeft: () => <Button onPress={() => albumScreenProps.navigation.goBack()} title="Back" />,
        headerRight: () => <AddAssetsButton selectedAssets={selectedAssets} onPress={confirmSelection} />,
        headerTitle: albumScreenProps.album.name,
      });
      return;
    }

    navigation.setOptions({
      headerLeft: () => <Button onPress={cancelSelection} title="Cancel" />,
      headerRight: () => <AddAssetsButton selectedAssets={selectedAssets} onPress={confirmSelection} />,
      headerTitle: () => (
        <PillButton
          activeButtonLabel={activeNavigationItem}
          leftButtonLabel="Assets"
          leftButtonOnPress={() => navigateTo('Assets')}
          rightButtonLabel="Albums"
          rightButtonOnPress={() => navigateTo('Albums')}
        />
      ),
    });
  }, [navigation, selectedAssets, albumScreenProps, activeNavigationItem]);

  return <AssetPickerStackNavigator />;
}
