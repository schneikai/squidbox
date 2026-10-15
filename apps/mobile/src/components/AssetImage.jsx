import { useEffect, useState, useRef } from 'react';
import { View, Image, Animated, StyleSheet } from 'react-native';

import useAppSettings from '@/features/app-settings/useAppSettings';
import useAssetThumbnailLoader from '@/features/asset-thumbnail-loader/useAssetThumbnailLoader';
import { motion } from '@/styles/designTokens';
import getAssetThumbnailUri from '@/utils/assets/thumbnails/getAssetThumbnailUri';
import hasThumbnailAsync from '@/utils/assets/thumbnails/hasThumbnailAsync';

// contentFit: "cover" | "contain". The placeholder pulses until the picture has loaded, and
// `overlay` (e.g. a cell's corner glows) shows only then.
export default function AssetImage({ asset = {}, contentFit, placeholderColor = 'lightgrey', overlay }) {
  const [thumbnailUri, setThumbnailUri] = useState(null);
  const [loadedUri, setLoadedUri] = useState(null);
  const { loadThumbnail } = useAssetThumbnailLoader();
  const { thumbnailStyle } = useAppSettings();

  // A different asset must not keep showing the previous one's picture until its own is found.
  useEffect(() => setThumbnailUri(null), [asset.thumbnailFilename]);

  useEffect(() => {
    const filename = asset.thumbnailFilename;
    if (!filename) return;
    let isCancelled = false;
    let interval;

    async function showIfOnDisk() {
      if (!(await hasThumbnailAsync(filename))) return false;
      if (!isCancelled) setThumbnailUri(getAssetThumbnailUri(filename));
      return true;
    }

    (async () => {
      if ((await showIfOnDisk()) || isCancelled) return;
      loadThumbnail(asset);
      // Poll until the download lands. A failed request (a network hiccup during the launch-sync
      // storm, a transient 401/403) frees its key, so asking again re-enqueues it, while
      // loadThumbnail dedupes requests still in flight: a blank cell heals instead of staying blank.
      interval = setInterval(async () => {
        if (await showIfOnDisk()) clearInterval(interval);
        else loadThumbnail(asset);
      }, 2000);
    })();

    return () => {
      isCancelled = true;
      clearInterval(interval);
    };
  }, [asset.thumbnailFilename, asset.isThumbnailSynced, loadThumbnail]);

  if (!asset.thumbnailFilename) return null;

  if (!thumbnailUri) {
    return <LoadingPlaceholder color={placeholderColor} />;
  }

  const isLoaded = loadedUri === thumbnailUri;
  const styleProps = {
    flex: 1,
    resizeMode: contentFit || thumbnailStyle,
    backgroundColor: placeholderColor !== 'transparent' ? placeholderColor : undefined,
  };

  return (
    <>
      <Image source={{ uri: thumbnailUri }} style={styleProps} onLoad={() => setLoadedUri(thumbnailUri)} />
      {isLoaded ? overlay : <LoadingPlaceholder color={placeholderColor} style={StyleSheet.absoluteFill} />}
    </>
  );
}

// Each placeholder breathes at its own pace from its own starting point, so a screen of loading cells
// doesn't pulse as one grey surface.
function LoadingPlaceholder({ color, style }) {
  const animatedValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const { duration, easing } = motion.pulse;
    const ownDuration = duration * (0.7 + Math.random() * 0.6);
    const half = (toValue) =>
      Animated.timing(animatedValue, { toValue, duration: ownDuration, easing, useNativeDriver: true });
    const animation = Animated.sequence([
      Animated.delay(Math.random() * ownDuration * 2),
      Animated.loop(Animated.sequence([half(1), half(0)])),
    ]);
    animation.start();
    return () => animation.stop();
  }, [animatedValue]);

  const overlayOpacity = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.5],
  });

  return (
    <View style={[{ flex: 1, backgroundColor: color }, style]}>
      <Animated.View style={{ flex: 1, backgroundColor: 'white', opacity: overlayOpacity }} />
    </View>
  );
}
