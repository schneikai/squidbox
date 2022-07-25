import { useState } from "react";
import { SafeAreaView } from "react-native";
import AssetDetailList from "components/AssetDetailList";
import { updateAsset, markAssetDeleted } from "services/AssetDataService";
import to from "await-to-js";
import { handleError } from "services/ErrorHandling";
import { useBlockingProgress } from "components/BlockingProgress";
import mediaLibraryDownload from "services/MediaLibraryDownload";
import { openAlbumLibrary } from "components/AlbumLibrary";
import { addAssetsToAlbum } from "services/AlbumAssetDataService";
import { newPostAsset } from "services/PostAssetDataService";
import { newPostData } from "services/PostDataService";

export default function AssetDetailScreen({
  navigation,
  route: {
    params: { asset, assets },
  },
}) {
  const [currentAsset, setCurrentAsset] = useState(asset);
  const BlockingProgress = useBlockingProgress();

  async function toggleAssetFavorite(asset) {
    asset.isFavorite = !asset.isFavorite;
    setCurrentAsset({ ...asset });
    const [err] = await to(updateAsset(asset.id, { isFavorite: asset.isFavorite }));
    if (err) {
      handleError("Failed to set favorite!", err);
      return;
    }
  }

  async function downloadAsset(asset) {
    BlockingProgress.show();

    try {
      await mediaLibraryDownload(asset, BlockingProgress.updateProgress);
    } catch (err) {
      handleError("Failed to download file!", err);
    } finally {
      BlockingProgress.hide();
    }
  }

  async function deleteAsset(asset) {
    const [err] = await to(markAssetDeleted(asset.id));
    if (err) {
      handleError("Failed to delete asset!", err);
      return;
    }
    navigation.goBack();
  }

  async function addToAlbum(asset) {
    const [err, album] = await to(openAlbumLibrary(navigation));
    if (err) {
      handleError("Failed to open album library!", err);
    }

    const [errAddAssets] = await to(addAssetsToAlbum(album.id, [asset]));
    if (errAddAssets) {
      handleError("Failed to add asset to album!", errAddAssets);
    }
  }

  function createPost(asset) {
    const postData = newPostData();
    postData.postAssets = [newPostAsset(asset)];
    navigation.navigate("NewPost", { postData });
  }

  return (
    <SafeAreaView>
      <AssetDetailList
        asset={currentAsset}
        assets={assets}
        onDeleteAsset={deleteAsset}
        onDownloadAsset={downloadAsset}
        onToggleAssetFavorite={toggleAssetFavorite}
        onAddToAlbum={addToAlbum}
        onCreatePost={createPost}
      />
    </SafeAreaView>
  );
}
