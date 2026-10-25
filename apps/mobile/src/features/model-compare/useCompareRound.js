import { useEffect, useRef, useState } from 'react';

import { compareVisionAsync, compareWritingAsync } from './aiApi';
import { addScore } from './aiState';
import apiErrorMessage from './apiErrorMessage';
import assignLetters from './assignLetters';
import readVisionImageAsync from './readVisionImageAsync';

import useAssetThumbnailLoader from '@/features/asset-thumbnail-loader/useAssetThumbnailLoader';
import useCloud from '@/features/cloud/useCloud';
import useHaptics from '@/hooks/useHaptics';
import useLibrary from '@/library/useLibrary';
import { getDb } from '@/sync/db/client';

// Photos tagged at once in a vision round: each is one request with every model.
const PHOTO_CONCURRENCY = 2;
// The results key of a writing round, which has no photos.
export const TEXT_KEY = 'text';

/**
 * One blind compare round at a time for `kind` over `modelIds`. `startRound({ prompt })` (writing)
 * or `startRound({ photos })` (vision, the assets) reshuffles the letters, clears the taps and asks
 * every model again; `number` counts the rounds. `results[key][modelId]` is `{ status: 'loading' | 'done' | 'error', items,
 * error }`, keyed by TEXT_KEY or the photo's asset id. `taps[key][modelId]` holds the indexes of
 * the tweets thumbed up or tags marked as fitting this round; `toggle` flips one and adds ±1 to the
 * model's score.
 */
export default function useCompareRound({ kind, modelIds }) {
  const haptics = useHaptics();
  const { paths: library } = useLibrary();
  const { isAuthenticated } = useCloud();
  const { loadThumbnail } = useAssetThumbnailLoader();
  const [round, setRound] = useState({ number: 0, letters: [], results: {}, taps: {}, isRunning: false });
  const controllerRef = useRef(null);

  useEffect(() => () => controllerRef.current?.abort(), []);

  function settle(signal, key, results) {
    if (signal.aborted) return;
    setRound((current) => ({ ...current, results: { ...current.results, [key]: results } }));
  }

  function failAll(error) {
    const message = apiErrorMessage(error);
    return Object.fromEntries(modelIds.map((modelId) => [modelId, { status: 'error', error: message }]));
  }

  async function runWriting(prompt, signal) {
    try {
      const results = await compareWritingAsync({ prompt, modelIds }, { signal });
      settle(signal, TEXT_KEY, byModel(results, 'tweets'));
    } catch (error) {
      settle(signal, TEXT_KEY, failAll(error));
    }
  }

  async function runPhoto(asset, signal) {
    try {
      const image = await readVisionImageAsync(asset, { library, loadThumbnail, isAuthenticated, signal });
      const results = await compareVisionAsync({ image, modelIds }, { signal });
      settle(signal, asset.id, byModel(results, 'tags'));
    } catch (error) {
      settle(signal, asset.id, failAll(error));
    }
  }

  async function runVision(photos, signal) {
    const queue = [...photos];
    async function worker() {
      while (queue.length > 0 && !signal.aborted) await runPhoto(queue.shift(), signal);
    }
    await Promise.all(Array.from({ length: PHOTO_CONCURRENCY }, worker));
  }

  async function startRound({ prompt, photos }) {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    const keys = kind === 'vision' ? photos.map(({ id }) => id) : [TEXT_KEY];
    const loading = Object.fromEntries(modelIds.map((modelId) => [modelId, { status: 'loading' }]));
    setRound((current) => ({
      number: current.number + 1,
      letters: assignLetters(modelIds),
      results: Object.fromEntries(keys.map((key) => [key, loading])),
      taps: {},
      isRunning: true,
    }));
    if (kind === 'vision') await runVision(photos, controller.signal);
    else await runWriting(prompt, controller.signal);
    if (!controller.signal.aborted) setRound((current) => ({ ...current, isRunning: false }));
  }

  function toggle(key, modelId, index) {
    const tapped = round.taps[key]?.[modelId] ?? [];
    const isOn = tapped.includes(index);
    const next = isOn ? tapped.filter((i) => i !== index) : [...tapped, index];
    setRound((current) => ({
      ...current,
      taps: { ...current.taps, [key]: { ...current.taps[key], [modelId]: next } },
    }));
    haptics.selection();
    addScore(getDb(), kind, modelId, isOn ? -1 : 1).catch((error) => console.error('Saving the score failed', error));
  }

  return { ...round, startRound, toggle };
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
