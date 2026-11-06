import type { AssetRecord } from '@squidbox/shared';
import { Alert } from 'react-native';

import MenuButton, { type MenuButtonProps } from '@/components/MenuButton';
import MenuOption from '@/components/popup-menu-options/MenuOption';
import useProgressOverlay from '@/components/progress-overlay/useProgressOverlay';
import { UPLOAD_MEDIA_FROM_DEVICE, UPLOAD_MEDIA_FROM_APP } from '@/constants';
import type { AssetExclude } from '@/features/asset-list/assetQuery';
import useAssetPicker from '@/features/asset-picker/useAssetPicker';
import useAddAssetsFromCameraRoll from '@/features/assets-context/useAddAssetsFromCameraRoll';
import apiErrorMessage from '@/utils/cloud-api/apiErrorMessage';

export type AddMediaMenuProps = {
  trigger: NonNullable<MenuButtonProps['trigger']>;
  exclude: AssetExclude;
  onAdd: (assets: AssetRecord[]) => unknown;
};

// A menu that adds media from the camera roll (imported with progress) or from the library, and hands
// the picked assets to `onAdd`. `exclude` is passed to the library picker; `trigger` as to MenuButton.
export default function AddMediaMenu({ trigger, exclude, onAdd }: AddMediaMenuProps) {
  const { openAssetPicker } = useAssetPicker();
  const { show, hide, updateProgress } = useProgressOverlay();
  const addAssetsFromCameraRollAsync = useAddAssetsFromCameraRoll({
    onStart: show,
    onProgress: updateProgress,
    onFinish: hide,
  });

  async function add(pickAssetsAsync: () => Promise<AssetRecord[]>) {
    try {
      const assets = await pickAssetsAsync();
      if (assets.length) await onAdd(assets);
    } catch (error) {
      Alert.alert("Couldn't add media", apiErrorMessage(error));
    }
  }

  return (
    <MenuButton trigger={trigger}>
      <MenuOption label={UPLOAD_MEDIA_FROM_DEVICE} icon="mobile" onPress={() => add(addAssetsFromCameraRollAsync)} />
      <MenuOption
        label={UPLOAD_MEDIA_FROM_APP}
        icon="library"
        onPress={() => add(() => openAssetPicker({ exclude }))}
      />
    </MenuButton>
  );
}
