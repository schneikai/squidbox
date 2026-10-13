import { Button } from 'react-native';

export default function AddAssetsButton({ count, onPress }) {
  const selectButtonDisabled = count === 0;
  const selectButtonLabel = count === 0 ? 'Add' : `Add ${count}`;

  return <Button onPress={onPress} disabled={selectButtonDisabled} title={selectButtonLabel} />;
}
