import AssetPickerContext, { type AssetPickerValue } from '@/features/asset-picker/AssetPickerContext';
import useRequiredContext from '@/hooks/useRequiredContext';

export default function useAssetPicker(): AssetPickerValue {
  return useRequiredContext(AssetPickerContext, 'useAssetPicker needs an AssetPickerProvider above it');
}
