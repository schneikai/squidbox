import { useEffect, useState, useRef } from 'react';
import { View, Image, Animated } from 'react-native';

import useAppSettings from '@/features/app-settings/useAppSettings';
import useAssetThumbnailLoader from '@/features/asset-thumbnail-loader/useAssetThumbnailLoader';
import getAssetThumbnailUri from '@/utils/assets/thumbnails/getAssetThumbnailUri';
import hasThumbnailAsync from '@/utils/assets/thumbnails/hasThumbnailAsync';

// contentFit: "cover" | "contain"
export default function AssetImage({ asset = {}, contentFit, placeholderColor = 'lightgrey' }) {
  const [thumbnailUri, setThumbnailUri] = useState(null);
  const { loadThumbnail } = useAssetThumbnailLoader();
  const { thumbnailStyle } = useAppSettings();

  useEffect(() => {
    if (!asset.thumbnailFilename) return;

    async function checkAssetThumbnail() {
      if (await hasThumbnailAsync(asset.thumbnailFilename)) {
        setThumbnailUri(getAssetThumbnailUri(asset.thumbnailFilename));
      } else {
        loadThumbnail(asset);
      }
    }
    checkAssetThumbnail();
  }, [asset.thumbnailFilename, asset.isThumbnailSynced]);

  useEffect(() => {
    if (!asset.thumbnailFilename) return;

    const interval = setInterval(async () => {
      if (thumbnailUri || (await hasThumbnailAsync(asset.thumbnailFilename))) {
        setThumbnailUri(getAssetThumbnailUri(asset.thumbnailFilename));
        clearInterval(interval);
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [asset.thumbnailFilename, asset.isThumbnailSynced]);

  if (!asset.thumbnailFilename) return null;

  if (!thumbnailUri) {
    return <LoadingPlaceholder color={placeholderColor} />;
  }

  const styleProps = {
    flex: 1,
    resizeMode: contentFit || thumbnailStyle,
    backgroundColor: placeholderColor !== 'transparent' ? placeholderColor : undefined,
  };

  return <Image source={{ uri: thumbnailUri }} style={styleProps} />;
}

function LoadingPlaceholder({ color }) {
  const animatedValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(animatedValue, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(animatedValue, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, [animatedValue]);

  const overlayOpacity = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.5],
  });

  return (
    <View style={{ flex: 1, backgroundColor: color }}>
      <Animated.View style={{ flex: 1, backgroundColor: 'white', opacity: overlayOpacity }} />
    </View>
  );
}
