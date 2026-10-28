import { useCallback, useEffect, useRef, useState } from 'react';

import assignLetters from './assignLetters';

import useHaptics from '@/hooks/useHaptics';
import useVisionImageDeps from '@/hooks/useVisionImageDeps';
import { addScore, markTried } from '@/sync/aiStateRepository';
import { getDb } from '@/sync/db/client';
import readVisionImageAsync from '@/utils/assets/readVisionImageAsync';
import compareAsync from '@/utils/cloud-api/ai/compareAsync';
import apiErrorMessage from '@/utils/cloud-api/apiErrorMessage';
import toggleItem from '@/utils/toggleItem';

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
  const imageDeps = useVisionImageDeps();
  const [round, setRound] = useState({ number: 0, letters: [], results: {}, taps: {} });
  const controllerRef = useRef(null);
  // The taps as of the last toggle: two taps before a re-render must see each other.
  const tapsRef = useRef({});
  // The models already marked as tried in this compare, so each is written once.
  const triedRef = useRef(new Set());

  useEffect(() => () => controllerRef.current?.abort(), []);

  function failAll(error) {
    const message = apiErrorMessage(error);
    return Object.fromEntries(modelIds.map((modelId) => [modelId, { status: 'error', error: message }]));
  }

  // One request of a round: its results key, the results' items key, and its body.
  function jobsFor({ prompt, photos }) {
    if (kind !== 'vision') return [{ key: TEXT_KEY, itemsKey: 'tweets', body: async () => ({ prompt, modelIds }) }];
    return photos.map((asset) => ({
      key: asset.id,
      itemsKey: 'tags',
      body: async (signal) => ({
        prompt,
        image: await readVisionImageAsync(asset, { ...imageDeps, signal }),
        modelIds,
      }),
    }));
  }

  function markTriedOnce(results) {
    const tried = triedRef.current;
    const newlyTried = Object.keys(results).filter((id) => results[id].status === 'done' && !tried.has(id));
    if (newlyTried.length === 0) return;
    newlyTried.forEach((id) => tried.add(id));
    markTried(getDb(), kind, newlyTried).catch((error) => console.error('Saving the score failed', error));
  }

  async function run(jobs, signal) {
    const queue = [...jobs];
    async function worker() {
      while (queue.length > 0 && !signal.aborted) {
        const job = queue.shift();
        let results;
        try {
          results = byModel(await compareAsync(kind, await job.body(signal), { signal }), job.itemsKey);
        } catch (error) {
          results = failAll(error);
        }
        if (signal.aborted) return;
        markTriedOnce(results);
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
      const nextTaps = { ...taps, [key]: { ...taps[key], [modelId]: toggleItem(tapped, index) } };
      tapsRef.current = nextTaps;
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
