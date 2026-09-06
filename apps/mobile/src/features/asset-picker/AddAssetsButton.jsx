import { Button } from 'react-native';

export default function AddAssetsButton({ selectedAssets, onPress }) {
  const selectButtonDisabled = selectedAssets.length === 0;
  const selectButtonLabel = selectedAssets.length === 0 ? 'Add' : `Add ${selectedAssets.length}`;

  return <Button onPress={onPress} disabled={selectButtonDisabled} title={selectButtonLabel} />;
}
