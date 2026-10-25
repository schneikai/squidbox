import { useCallback, useEffect, useRef, useState } from 'react';

import { compareVisionAsync, compareWritingAsync } from './aiApi';
import apiErrorMessage from './apiErrorMessage';
import assignLetters from './assignLetters';
import readVisionImageAsync from './readVisionImageAsync';

import useAssetThumbnailLoader from '@/features/asset-thumbnail-loader/useAssetThumbnailLoader';
import useCloud from '@/features/cloud/useCloud';
import useHaptics from '@/hooks/useHaptics';
import useLibrary from '@/library/useLibrary';
import { addScore, markTried } from '@/sync/aiStateRepository';
import { getDb } from '@/sync/db/client';

// Requests in flight at once in a round: a vision round is one request per photo with every model.
const CONCURRENCY = 2;
// The results key of a writing round, which has no photos.
export const TEXT_KEY = 'text';

/**
 * One blind compare round at a time for `kind` over `modelIds`. `startRound({ prompt })` (writing)
 * or `startRound({ prompt, photos })` (vision, the assets) reshuffles the letters, clears the taps and asks
 * every model again; `number` counts the rounds. `results[key][modelId]` is `{ status: 'loading' |
 * 'done' | 'error', items, error }`, keyed by TEXT_KEY or the photo's asset id, and `isRunning`
 * while any is loading. `taps[key][modelId]` holds the indexes of the tweets thumbed up or tags
 * marked as fitting this round; `toggle(key, modelId, index)` flips one and adds ±1 to the model's
 * score. `toggle` is stable, so memoized rows keep it.
 */
export default function useCompareRound({ kind, modelIds }) {
  const haptics = useHaptics();
  const { paths: library } = useLibrary();
  const { isAuthenticated } = useCloud();
  const { loadThumbnail } = useAssetThumbnailLoader();
  const [round, setRound] = useState({ number: 0, letters: [], results: {}, taps: {} });
  const controllerRef = useRef(null);
  // The taps as of the last toggle: two taps before a re-render must see each other.
  const tapsRef = useRef({});
  // Each photo's image, read and resized once for all the rounds of this compare.
  const imagesRef = useRef(new Map());

  useEffect(() => () => controllerRef.current?.abort(), []);

  function imageFor(asset) {
    const images = imagesRef.current;
    if (!images.has(asset.id)) {
      const image = readVisionImageAsync(asset, { library, loadThumbnail, isAuthenticated });
      images.set(asset.id, image);
      image.catch(() => images.delete(asset.id)); // the next round tries again
    }
    return images.get(asset.id);
  }

  function failAll(error) {
    const message = apiErrorMessage(error);
    return Object.fromEntries(modelIds.map((modelId) => [modelId, { status: 'error', error: message }]));
  }

  // One request of a round: its results key, how to ask, the results' items key, and what to get
  // ready while the request before it runs.
  function jobsFor({ prompt, photos }) {
    if (kind !== 'vision') {
      return [
        { key: TEXT_KEY, itemsKey: 'tweets', ask: (signal) => compareWritingAsync({ prompt, modelIds }, { signal }) },
      ];
    }
    return photos.map((asset) => ({
      key: asset.id,
      itemsKey: 'tags',
      prepare: () => imageFor(asset),
      ask: async (signal) => compareVisionAsync({ prompt, image: await imageFor(asset), modelIds }, { signal }),
    }));
  }

  async function run(jobs, signal) {
    const queue = [...jobs];
    async function worker() {
      while (queue.length > 0 && !signal.aborted) {
        const job = queue.shift();
        queue[0]?.prepare?.(); // one ahead: the next photo resizes while this one is asked
        let results;
        try {
          results = byModel(await job.ask(signal), job.itemsKey);
        } catch (error) {
          results = failAll(error);
        }
        if (signal.aborted) return;
        const answered = Object.keys(results).filter((modelId) => results[modelId].status === 'done');
        markTried(getDb(), kind, answered).catch((error) => console.error('Saving the score failed', error));
        setRound((current) => ({ ...current, results: { ...current.results, [job.key]: results } }));
      }
    }
    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  }

  function startRound(input) {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    const jobs = jobsFor(input);
    const loading = Object.fromEntries(modelIds.map((modelId) => [modelId, { status: 'loading' }]));
    tapsRef.current = {};
    setRound((current) => ({
      number: current.number + 1,
      letters: assignLetters(modelIds),
      results: Object.fromEntries(jobs.map(({ key }) => [key, loading])),
      taps: {},
    }));
    return run(jobs, controller.signal);
  }

  const toggle = useCallback(
    (key, modelId, index) => {
      const taps = tapsRef.current;
      const tapped = taps[key]?.[modelId] ?? [];
      const isOn = tapped.includes(index);
      const next = isOn ? tapped.filter((i) => i !== index) : [...tapped, index];
      tapsRef.current = { ...taps, [key]: { ...taps[key], [modelId]: next } };
      const nextTaps = tapsRef.current;
      setRound((current) => ({ ...current, taps: nextTaps }));
      haptics.selection();
      addScore(getDb(), kind, modelId, isOn ? -1 : 1).catch((error) => console.error('Saving the score failed', error));
    },
    [kind, haptics],
  );

  const isRunning = Object.values(round.results).some((byModelId) =>
    Object.values(byModelId).some(({ status }) => status === 'loading'),
  );

  return { ...round, isRunning, startRound, toggle };
}

// The server's results by model: `{ status: 'done', items }` or `{ status: 'error', error }`.
function byModel(results, itemsKey) {
  return Object.fromEntries(
    results.map((result) => [
      result.modelId,
      result.error ? { status: 'error', error: result.error } : { status: 'done', items: result[itemsKey] },
    ]),
  );
}
