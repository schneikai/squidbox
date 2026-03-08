import { use } from 'react';

import AssetPickerContext from '@/features/asset-picker/AssetPickerContext';

export default function useAssetPicker() {
  return use(AssetPickerContext);
}
