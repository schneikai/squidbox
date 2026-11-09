import { ALBUM_TAG_PHOTOS, type VisionImage } from '@squidbox/shared';
import { useEffect, useRef, useState } from 'react';

import spreadSample from './spreadSample';

import useHaptics from '@/hooks/useHaptics';
import useVisionImageDeps from '@/hooks/useVisionImageDeps';
import { getDb } from '@/sync/db/client';
import * as schema from '@/sync/db/schema';
import { readByIds } from '@/sync/readByIds';
import readVisionImageAsync from '@/utils/assets/readVisionImageAsync';
import tagAlbumAsync from '@/utils/cloud-api/ai/tagAlbumAsync';
import apiErrorMessage from '@/utils/cloud-api/apiErrorMessage';

/**
 * An album's Tag it, from its Tags sheet: `tagIt(photoIds)` (the album's photos in its order) sends
 * ALBUM_TAG_PHOTOS of them spread through it (spreadSample) in one request (POST /ai/album-tags) and
 * resolves to the tags, or to null once it failed (`error` says why). It goes out with the photos
 * whose thumbnail could be read, and fails only when none could. Nothing is stored. Leaving the sheet
 * stops it, and a result after that is dropped. A success or a failure is felt.
 */
export default function useAlbumTagIt() {
  const haptics = useHaptics();
  const deps = useVisionImageDeps();
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => () => controllerRef.current?.abort(), []);

  async function tagIt(photoIds: string[]): Promise<string[] | null> {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    const { signal } = controller;
    setIsRunning(true);
    setError(null);
    try {
      const assets = await readByIds(getDb(), schema.assets, spreadSample(photoIds, ALBUM_TAG_PHOTOS));
      const reads = await Promise.allSettled(assets.map((asset) => readVisionImageAsync(asset, { ...deps, signal })));
      const images = reads.flatMap((read): VisionImage[] => (read.status === 'fulfilled' ? [read.value] : []));
      if (images.length === 0) {
        const failed = reads.find((read) => read.status === 'rejected');
        throw failed ? failed.reason : new Error('This album has no photos');
      }
      const tags = await tagAlbumAsync(images, signal);
      if (signal.aborted) return null;
      haptics.success();
      setIsRunning(false);
      return tags;
    } catch (caught) {
      if (signal.aborted) return null;
      haptics.error();
      setError(apiErrorMessage(caught));
      setIsRunning(false);
      return null;
    }
  }

  return { tagIt, isRunning, error };
}
