import { useEffect, useState, useRef } from 'react';
import { View, Image, Animated, StyleSheet } from 'react-native';

import Icon from '@/components/Icon';
import useAppSettings from '@/features/app-settings/useAppSettings';
import useAssetThumbnailLoader from '@/features/asset-thumbnail-loader/useAssetThumbnailLoader';
import useCloud from '@/features/cloud/useCloud';
import useLibrary from '@/library/useLibrary';
import { colors, motion, sizes } from '@/styles/designTokens';
import { getAssetThumbnailUri } from '@/utils/assets/assetStorage';
import assetFileUnavailableMessages from '@/utils/assets/files/assetFileUnavailableMessages';
import getAssetThumbnailStatusAsync from '@/utils/assets/thumbnails/getAssetThumbnailStatusAsync';

// Thumbnails that have loaded on this device since launch. A cell that shows one again (an album
// opened again, the cell a drag lifts) skips the file check and the placeholder: the picture comes
// from the image cache within a frame. One that fails to load is checked again.
const shownUris = new Set();
const MAX_SHOWN_URIS = 10000;

function rememberShown(uri) {
  if (shownUris.size >= MAX_SHOWN_URIS) shownUris.delete(shownUris.values().next().value);
  shownUris.add(uri);
}

// contentFit: "cover" | "contain". The placeholder pulses until the picture has loaded (and holds
// still while nobody is signed in to fetch it, once its download gave up, or without a thumbnail at
// all). `renderOverlay(hasPicture, status)`
// draws over the cell either way, e.g. corner badges that only make sense over a loaded picture;
// `status` is getAssetThumbnailStatusAsync's once known. A
// thumbnail its device hasn't backed up yet gets a crossed-out cloud on the placeholder while
// `showNotUploaded`.
export default function AssetImage({
  asset = {},
  contentFit,
  placeholderColor = colors.background.placeholder,
  renderOverlay,
  showNotUploaded = true,
}) {
  // getAssetThumbnailStatusAsync's for `filename` (or the loader's 'failed').
  const [found, setFound] = useState(null);
  const [loadedUri, setLoadedUri] = useState(null);
  const { loadThumbnail } = useAssetThumbnailLoader();
  const { isAuthenticated } = useCloud();
  const { paths: library } = useLibrary();
  const { thumbnailStyle } = useAppSettings();
  const localUri = asset.thumbnailFilename && getAssetThumbnailUri(asset.thumbnailFilename, library);
  const wasShown = !!localUri && shownUris.has(localUri);
  // A recycled cell must not show the previous asset's status or picture.
  const current = found?.filename === asset.thumbnailFilename ? found : null;
  const isLocal = wasShown || current?.status === 'local';

  useEffect(() => {
    const filename = asset.thumbnailFilename;
    if (!filename || isLocal) return;
    const controller = new AbortController();
    let withdraw;

    function showLocal() {
      setFound({ filename, status: 'local' });
    }

    (async () => {
      const status = await getAssetThumbnailStatusAsync(asset, {
        isAuthenticated,
        library,
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      if (status === 'local') {
        showLocal();
        return;
      }
      setFound({ filename, status });
      // Only a cloud copy can arrive. A not-uploaded one waits for sync to flip isThumbnailSynced,
      // a signed-out one for the session, either of which reruns this effect. The loader retries a
      // failed download a few times before it gives up; a remount asks again.
      if (status !== 'remote') return;
      withdraw = loadThumbnail(asset, (result) => {
        if (result === 'done') showLocal();
        else setFound({ filename, status: 'failed' });
      });
    })();

    return () => {
      controller.abort();
      withdraw?.();
    };
  }, [asset.thumbnailFilename, asset.isThumbnailSynced, isAuthenticated, isLocal, library, loadThumbnail]);

  const thumbnailUri = isLocal ? localUri : null;
  const hasPicture = !!thumbnailUri && (wasShown || loadedUri === thumbnailUri);
  const showNotUploadedIcon = showNotUploaded && current?.status === 'notUploaded';

  const styleProps = {
    flex: 1,
    resizeMode: contentFit || thumbnailStyle,
    backgroundColor: placeholderColor !== 'transparent' ? placeholderColor : undefined,
  };

  // One tree for every state, so the placeholder keeps pulsing and the overlay stays mounted while
  // the picture loads.
  return (
    <>
      {!!thumbnailUri && (
        <Image
          // A new picture gets a new view, so a recycled cell never shows the last one while it loads.
          key={thumbnailUri}
          source={{ uri: thumbnailUri }}
          style={styleProps}
          onLoad={() => {
            rememberShown(thumbnailUri);
            setLoadedUri(thumbnailUri);
          }}
          onError={() => {
            shownUris.delete(thumbnailUri);
            // Shown from memory, it gets the file check a first mount would. A checked file that still
            // won't load keeps the placeholder, rather than being checked and shown over and over.
            if (found?.filename !== asset.thumbnailFilename) setFound({ filename: asset.thumbnailFilename });
            else setFound({ ...found });
          }}
        />
      )}
      {!hasPicture && (
        <LoadingPlaceholder
          color={placeholderColor}
          style={!!thumbnailUri && StyleSheet.absoluteFill}
          still={!asset.thumbnailFilename || current?.status === 'signedOut' || current?.status === 'failed'}
        >
          {showNotUploadedIcon && (
            <View
              style={styles.notUploaded}
              accessible
              accessibilityRole="image"
              accessibilityLabel={assetFileUnavailableMessages.notUploaded.title}
            >
              <Icon
                name={assetFileUnavailableMessages.notUploaded.icon}
                size={sizes.iconLarge}
                color={colors.text.secondary}
              />
            </View>
          )}
        </LoadingPlaceholder>
      )}
      {renderOverlay?.(hasPicture, current?.status)}
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
      <Animated.View style={{ flex: 1, backgroundColor: colors.background.shimmer, opacity: overlayOpacity }} />
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
