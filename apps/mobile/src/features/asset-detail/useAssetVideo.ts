import { useFocusEffect } from 'expo-router';
import { createVideoPlayer, type VideoPlayer } from 'expo-video';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import useOpenLibrary from '@/library/useOpenLibrary';
import useCloud from '@/providers/cloud/useCloud';
import type { AssetRow } from '@/sync/db/schema';
import { markDownloadUsed } from '@/utils/assets/assetStorage';
import { MEDIA_TYPES } from '@/utils/assets/constants';
import getAssetFileSourceAsync, { type AssetFileSource } from '@/utils/assets/files/getAssetFileSourceAsync';
import type {
  AssetFileAsset,
  AssetFileLocation,
  UnavailableStatus,
} from '@/utils/assets/files/getAssetFileStatusAsync';

const TIME_UPDATE_INTERVAL = 0.25;
// Presigned URLs last an hour (the server's default): a revisited cloud video reuses its URL for
// half that instead of waiting for a new one.
const URL_REUSE_MS = 30 * 60 * 1000;

// The player's own failure, in AssetFileSource's shape (the members it doesn't get are undefined).
type FailedSource = { uri?: undefined; isRemote?: undefined; status: 'error' };
type ResolvedSource = { assetId: string; resolvedAt: number } & (AssetFileSource | FailedSource);

export type VideoStatus = UnavailableStatus | 'error' | 'loading';
export type AssetVideo =
  | { key: string; player: VideoPlayer; status: 'ready'; isRemote: boolean }
  | { key: string; player: null; status: VideoStatus; isRemote: false };

/**
 * The asset detail screen's one player, for `asset` while it is a video (null otherwise). A player
 * exists only once the file is found (getAssetFileSourceAsync), pauses when the screen loses focus,
 * and is released when the asset changes. VideoControls starts it.
 *
 * Returns `{ key, player, status, isRemote }`: `player` is null while `status` is 'loading',
 * 'notUploaded', 'signedOut' or 'error'. `key` changes with the player, for components to start fresh.
 */
export default function useAssetVideo(
  asset: Pick<AssetRow, 'id' | 'mediaType' | 'filename' | 'isFileSynced'> | undefined,
): AssetVideo | null {
  const { isAuthenticated } = useCloud();
  const { paths: library } = useOpenLibrary();
  const [resolved, setResolved] = useState<ResolvedSource | null>(null);
  const [playback, setPlayback] = useState<{ uri: string; player: VideoPlayer } | null>(null);
  // Cloud URLs by filename, for revisits.
  const urlsRef = useRef(new Map<string, ResolvedSource>());
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
    if (!assetId || filename === undefined) return;
    let isCancelled = false;
    const urls = urlsRef.current;
    const cached = urls.get(filename);
    if (cached && isFreshUrl(cached, isAuthenticated)) {
      setResolved(cached);
      return () => setResolved(null);
    }
    resolveSourceAsync({ filename, isFileSynced: isFileSyncedRef.current }, { isAuthenticated, library }).then(
      (found) => {
        const entry: ResolvedSource = { assetId, ...found, resolvedAt: Date.now() };
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
    // A player exists only for a found uri; `source.uri` narrows the source to it.
    if (player && source?.uri) return { key: source.uri, player, status: 'ready', isRemote: source.isRemote };
    const status = source?.status ?? 'loading';
    return { key: status, player: null, status, isRemote: false };
  }, [assetId, player, source]);
}

// A cloud URL found earlier serves again while it's fresh and someone is signed in.
function isFreshUrl(entry: ResolvedSource, isAuthenticated: boolean): boolean {
  return isAuthenticated && Date.now() - entry.resolvedAt < URL_REUSE_MS;
}

async function resolveSourceAsync(
  asset: AssetFileAsset,
  options: AssetFileLocation,
): Promise<AssetFileSource | FailedSource> {
  try {
    const source = await getAssetFileSourceAsync(asset, options);
    // Played from a kept download: marked used, so the stale sweep doesn't delete it while it plays.
    if (source.isKeptDownload) markDownloadUsed(asset.filename, options.library);
    return source;
  } catch {
    return { status: 'error' };
  }
}
