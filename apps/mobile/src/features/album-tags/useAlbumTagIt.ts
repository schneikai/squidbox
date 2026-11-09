import { useEffect, useRef, useState } from 'react';

import countTags from './countTags';
import spreadSample from './spreadSample';

import useHaptics from '@/hooks/useHaptics';
import useVisionImageDeps from '@/hooks/useVisionImageDeps';
import { getDb } from '@/sync/db/client';
import * as schema from '@/sync/db/schema';
import { readByIds } from '@/sync/readByIds';
import readVisionImageAsync from '@/utils/assets/readVisionImageAsync';
import tagPhotoAsync from '@/utils/cloud-api/ai/tagPhotoAsync';
import apiErrorMessage from '@/utils/cloud-api/apiErrorMessage';

// Photos an album's Tag it tags: the first, the last and evenly between, in the album's order.
const SAMPLE_PHOTOS = 4;
// Tags it suggests at most, so photos keep room for their own (ASSET_TAG_LIMITS.tags each).
const SUGGESTED_TAGS = 10;

/**
 * An album's Tag it: `tagIt(photoIds)` (in the album's order) tags SAMPLE_PHOTOS of them spread
 * through it, each by itself (POST /ai/tags, as a photo's Tag it, at the same time), and resolves to
 * their tags ranked by how many of them have each (countTags), or to null once it failed
 * (`error`): a photo that can't be read or tagged is left out, and it fails only when every one did.
 * Unmounting aborts it. Stores nothing on the photos. A failure is felt; the caller plays the success.
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
      // A photo trashed since the sheet opened isn't sent.
      const assets = (await readByIds(getDb(), schema.assets, spreadSample(photoIds, SAMPLE_PHOTOS))).filter(
        (asset) => asset.deletedAt === null,
      );
      if (assets.length === 0) throw new Error('This album has no photos');
      const results = await Promise.allSettled(
        assets.map(async (asset) => tagPhotoAsync(await readVisionImageAsync(asset, { ...deps, signal }), signal)),
      );
      if (signal.aborted) return null;
      const lists = results.flatMap((result) => (result.status === 'fulfilled' ? [result.value] : []));
      if (lists.length === 0) throw (results[0] as PromiseRejectedResult).reason;
      return countTags(lists)
        .slice(0, SUGGESTED_TAGS)
        .map((entry) => entry.tag);
    } catch (caught) {
      if (signal.aborted) return null;
      haptics.error();
      setError(apiErrorMessage(caught));
      return null;
    } finally {
      if (!signal.aborted) setIsRunning(false);
    }
  }

  return { tagIt, isRunning, error };
}
