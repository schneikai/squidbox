import { useContext } from 'react';

import AssetPickerContext from '@/features/asset-picker/AssetPickerContext';

export default function useAssetPicker() {
  return useContext(AssetPickerContext);
}
