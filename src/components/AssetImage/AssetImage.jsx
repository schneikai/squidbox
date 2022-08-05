import { Image } from "react-native";
import CachedImage from "expo-cached-image";
import { thumbnailPathToUri } from "services/AssetThumbnailService";

export default function AssetImage({ asset, ...props }) {
  if (asset.isUploaded) {
    return <CachedImage source={{ uri: asset.thumbnailUrl }} cacheKey={asset.id} {...props} />;
  } else {
    return <Image source={{ uri: thumbnailPathToUri(asset.thumbnailPath) }} {...props} />;
  }
}
