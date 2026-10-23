import { Alert } from 'react-native';

import MenuButton from '@/components/MenuButton';
import MenuOption from '@/components/popup-menu-options/MenuOption';
import useProgressOverlay from '@/components/progress-overlay/useProgressOverlay';
import { UPLOAD_MEDIA_FROM_DEVICE, UPLOAD_MEDIA_FROM_APP } from '@/constants';
import useAssetPicker from '@/features/asset-picker/useAssetPicker';
import useAddAssetsFromCameraRoll from '@/features/assets-context/useAddAssetsFromCameraRoll';

// A menu that adds media from the camera roll (imported with progress) or from the library, and hands
// the picked assets to `onAdd`. `exclude` is passed to the library picker; `trigger` as to MenuButton.
export default function AddMediaMenu({ trigger, exclude, onAdd }) {
  const { openAssetPicker } = useAssetPicker();
  const { show, hide, updateProgress } = useProgressOverlay();
  const addAssetsFromCameraRollAsync = useAddAssetsFromCameraRoll({
    onStart: show,
    onProgress: updateProgress,
    onFinish: hide,
  });

  async function add(pickAssetsAsync) {
    try {
      const assets = await pickAssetsAsync();
      if (assets.length) await onAdd(assets);
    } catch (error) {
      Alert.alert("Couldn't add media", error.message);
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
