import { Image } from "react-native";
import CachedImage from "expo-cached-image";

export default function AssetImage({ asset, ...props }) {
  if (asset.isUploaded) {
    return <CachedImage source={{ uri: asset.thumbnailUrl }} cacheKey={asset.id} {...props} />;
  } else {
    return <Image source={{ uri: asset.thumbnailUri }} {...props} />;
  }
}
