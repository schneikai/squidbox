import { useFocusEffect } from '@react-navigation/native';
import { createVideoPlayer } from 'expo-video';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import useCloud from '@/features/cloud/useCloud';
import useLibrary from '@/library/useLibrary';
import { MEDIA_TYPES } from '@/utils/assets/constants';
import getAssetFileSourceAsync from '@/utils/assets/files/getAssetFileSourceAsync';

const TIME_UPDATE_INTERVAL = 0.25;
// Presigned URLs last an hour (the server's default): a revisited cloud video reuses its URL for
// half that instead of waiting for a new one.
const URL_REUSE_MS = 30 * 60 * 1000;

/**
 * The asset detail screen's one player, for `asset` while it is a video (null otherwise). A player
 * exists only once the file is found (getAssetFileSourceAsync), pauses when the screen loses focus,
 * and is released when the asset changes. VideoControls starts it.
 *
 * Returns `{ key, player, status, isRemote }`: `player` is null while `status` is 'loading',
 * 'notUploaded', 'signedOut' or 'error'. `key` changes with the player, for components to start fresh.
 */
export default function useAssetVideo(asset) {
  const { isAuthenticated } = useCloud();
  const { paths: library } = useLibrary();
  const [resolved, setResolved] = useState(null);
  const [playback, setPlayback] = useState(null);
  // Cloud URLs by filename, for revisits.
  const urlsRef = useRef(new Map());
  const videoAsset = asset?.mediaType === MEDIA_TYPES.VIDEO ? asset : null;
  const assetId = videoAsset?.id;
  const filename = videoAsset?.filename;
  // Read when resolving, not a reason to: a backup finishing mid-playback must not swap the source.
  const isFileSyncedRef = useRef(false);
  isFileSyncedRef.current = !!videoAsset?.isFileSynced;

  // Each visit finds its source anew (cleared on leaving), so an old one never plays unchecked.
  const source = resolved?.assetId === assetId ? resolved : null;
  const uri = source?.uri;
  const player = playback && playback.uri === uri ? playback.player : null;

  // Declared before the player's effect, so a replaced player is paused before it's released.
  useFocusEffect(useCallback(() => () => player?.pause(), [player]));

  useEffect(() => {
    if (!assetId) return;
    let isCancelled = false;
    const urls = urlsRef.current;
    const cached = urls.get(filename);
    if (isFreshUrl(cached, isAuthenticated)) {
      setResolved(cached);
      return () => setResolved(null);
    }
    resolveSourceAsync({ filename, isFileSynced: isFileSyncedRef.current }, { isAuthenticated, library }).then(
      (found) => {
        const entry = { assetId, ...found, resolvedAt: Date.now() };
        if (entry.isRemote) urls.set(filename, entry);
        if (!isCancelled) setResolved(entry);
      },
    );
    return () => {
      isCancelled = true;
      setResolved(null);
    };
  }, [assetId, filename, isAuthenticated, library]);

  useEffect(() => {
    if (!uri) return;
    const newPlayer = createVideoPlayer(uri);
    newPlayer.timeUpdateEventInterval = TIME_UPDATE_INTERVAL;
    setPlayback({ uri, player: newPlayer });
    return () => {
      newPlayer.release();
      // A later visit with the same (reused) URL must not find this player.
      setPlayback(null);
    };
  }, [uri]);

  return useMemo(() => {
    if (!assetId) return null;
    if (player) return { key: uri, player, status: 'ready', isRemote: source.isRemote };
    const status = source?.status ?? 'loading';
    return { key: status, player: null, status, isRemote: false };
  }, [assetId, player, uri, source]);
}

// A cloud URL found earlier serves again while it's fresh and someone is signed in.
function isFreshUrl(entry, isAuthenticated) {
  return !!entry && isAuthenticated && Date.now() - entry.resolvedAt < URL_REUSE_MS;
}

async function resolveSourceAsync(asset, options) {
  try {
    return await getAssetFileSourceAsync(asset, options);
  } catch {
    return { status: 'error' };
  }
}
