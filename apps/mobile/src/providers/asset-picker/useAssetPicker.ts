import useRequiredContext from '@/hooks/useRequiredContext';
import AssetPickerContext, { type AssetPickerValue } from '@/providers/asset-picker/AssetPickerContext';

export default function useAssetPicker(): AssetPickerValue {
  return useRequiredContext(AssetPickerContext, 'useAssetPicker needs an AssetPickerProvider above it');
}
