import useHaptics from '@/hooks/useHaptics';
import useRunWithAssetFiles from '@/utils/assets/files/useRunWithAssetFiles';
import askForMediaLibraryPermissionViaSettings from '@/utils/media-library/askForMediaLibraryPermissionViaSettings';
import copyToMediaLibraryAsync from '@/utils/media-library/copyToMediaLibraryAsync';
import getMediaLibraryPermissionAsync from '@/utils/media-library/getMediaLibraryPermissionAsync';

// Saves assets' full-resolution files to the camera roll.
export default function useSaveAssetsToMediaLibrary() {
  const runWithAssetFilesAsync = useRunWithAssetFiles();
  const haptics = useHaptics();

  async function saveAssetsToMediaLibraryAsync(assets) {
    const isSaved = await runWithAssetFilesAsync(assets, (uri) => copyToMediaLibraryAsync(uri), {
      failureTitle: "Couldn't save",
      prepareAsync: hasPermissionAsync,
    });
    if (isSaved) haptics.success();
  }

  return saveAssetsToMediaLibraryAsync;
}

// Asked once, before anything downloads.
async function hasPermissionAsync() {
  if (await getMediaLibraryPermissionAsync()) return true;
  askForMediaLibraryPermissionViaSettings();
  return false;
}
