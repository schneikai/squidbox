import { useEffect, useState, useRef } from 'react';
import { View, Image, Animated, StyleSheet } from 'react-native';

import Icon from '@/components/Icon';
import useAppSettings from '@/features/app-settings/useAppSettings';
import useAssetThumbnailLoader from '@/features/asset-thumbnail-loader/useAssetThumbnailLoader';
import useCloud from '@/features/cloud/useCloud';
import { colors, motion, spacing } from '@/styles/designTokens';
import assetFileUnavailableMessages from '@/utils/assets/files/assetFileUnavailableMessages';
import getAssetThumbnailStatusAsync from '@/utils/assets/thumbnails/getAssetThumbnailStatusAsync';
import getAssetThumbnailUri from '@/utils/assets/thumbnails/getAssetThumbnailUri';
import hasThumbnailAsync from '@/utils/assets/thumbnails/hasThumbnailAsync';

// contentFit: "cover" | "contain". The placeholder pulses until the picture has loaded (and holds
// still while nobody is signed in to fetch it). `renderOverlay(hasPicture)` draws over the cell either
// way, e.g. corner badges that only make sense over a loaded picture. A thumbnail its device hasn't
// backed up yet gets a crossed-out cloud on the placeholder while `showNotUploaded`.
export default function AssetImage({
  asset = {},
  contentFit,
  placeholderColor = 'lightgrey',
  renderOverlay,
  showNotUploaded = true,
}) {
  // getAssetThumbnailStatusAsync's for `filename`, with the picture's `uri` once it's 'local'.
  const [found, setFound] = useState(null);
  const [loadedUri, setLoadedUri] = useState(null);
  const { loadThumbnail } = useAssetThumbnailLoader();
  const { isAuthenticated } = useCloud();
  const { thumbnailStyle } = useAppSettings();
  // A recycled cell must not show the previous asset's status or picture.
  const current = found?.filename === asset.thumbnailFilename ? found : null;
  const isLocal = current?.status === 'local';

  useEffect(() => {
    const filename = asset.thumbnailFilename;
    if (!filename || isLocal) return;
    let isCancelled = false;
    let interval;

    function showLocal() {
      setFound({ filename, status: 'local', uri: getAssetThumbnailUri(filename) });
    }

    (async () => {
      const status = await getAssetThumbnailStatusAsync(asset, { isAuthenticated });
      if (isCancelled) return;
      if (status === 'local') {
        showLocal();
        return;
      }
      setFound({ filename, status });
      // Only a cloud copy can arrive. A not-uploaded one waits for sync to flip isThumbnailSynced,
      // a signed-out one for the session, either of which reruns this effect.
      if (status !== 'remote') return;
      loadThumbnail(asset);
      // Poll until the download lands. A failed request (a network hiccup during the launch-sync
      // storm, a transient 401/403) frees its key, so asking again re-enqueues it, while
      // loadThumbnail dedupes requests still in flight: a blank cell heals instead of staying blank.
      interval = setInterval(async () => {
        const isOnDisk = await hasThumbnailAsync(filename);
        if (isCancelled) return;
        if (isOnDisk) showLocal();
        else loadThumbnail(asset);
      }, 2000);
    })();

    return () => {
      isCancelled = true;
      clearInterval(interval);
    };
  }, [asset.thumbnailFilename, asset.isThumbnailSynced, isAuthenticated, isLocal, loadThumbnail]);

  const thumbnailUri = isLocal ? current.uri : null;
  const hasPicture = !!thumbnailUri && loadedUri === thumbnailUri;
  const showNotUploadedIcon = showNotUploaded && current?.status === 'notUploaded';

  if (!asset.thumbnailFilename) return null;

  if (!thumbnailUri) {
    return (
      <>
        <LoadingPlaceholder color={placeholderColor} still={current?.status === 'signedOut'}>
          {showNotUploadedIcon && (
            <View
              style={styles.notUploaded}
              accessible
              accessibilityRole="image"
              accessibilityLabel={assetFileUnavailableMessages.notUploaded.title}
            >
              <Icon
                name={assetFileUnavailableMessages.notUploaded.icon}
                size={spacing.iconSizeLarge}
                color={colors.textSecondary}
              />
            </View>
          )}
        </LoadingPlaceholder>
        {renderOverlay?.(false)}
      </>
    );
  }

  const styleProps = {
    flex: 1,
    resizeMode: contentFit || thumbnailStyle,
    backgroundColor: placeholderColor !== 'transparent' ? placeholderColor : undefined,
  };

  return (
    <>
      <Image source={{ uri: thumbnailUri }} style={styleProps} onLoad={() => setLoadedUri(thumbnailUri)} />
      {!hasPicture && <LoadingPlaceholder color={placeholderColor} style={StyleSheet.absoluteFill} />}
      {renderOverlay?.(hasPicture)}
    </>
  );
}

// Each placeholder breathes at its own pace from its own starting point, so a screen of loading cells
// doesn't pulse as one grey surface. A still one says nothing is coming.
function LoadingPlaceholder({ color, style, still = false, children }) {
  const animatedValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (still) return undefined;
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
  }, [animatedValue, still]);

  const overlayOpacity = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.25],
  });

  return (
    <View style={[{ flex: 1, backgroundColor: color }, style]}>
      <Animated.View style={{ flex: 1, backgroundColor: 'white', opacity: overlayOpacity }} />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  notUploaded: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
