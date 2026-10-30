import { useCallback, useEffect, useRef, useState } from 'react';

import assignLetters from './assignLetters';

import useHaptics from '@/hooks/useHaptics';
import useVisionImageDeps from '@/hooks/useVisionImageDeps';
import { addScore, markTried } from '@/sync/aiStateRepository';
import { getDb } from '@/sync/db/client';
import readVisionImageAsync from '@/utils/assets/readVisionImageAsync';
import compareAsync from '@/utils/cloud-api/ai/compareAsync';
import apiErrorMessage from '@/utils/cloud-api/apiErrorMessage';

// A request the tunnel of the dev client turned away (503) is asked once more after this pause:
// it never reached the server.
const RETRY_DELAY_MS = 1500;
// The results key of a writing round, which has no photos.
export const TEXT_KEY = 'text';

/**
 * One blind compare round at a time for `kind` over `modelIds`. `startRound({ prompt })` (writing)
 * or `startRound({ prompt, photos })` (vision, the assets) reshuffles the letters, clears the taps and asks
 * every model again; `number` counts the rounds, and `promptRound` the rounds with the same prompt,
 * whose earlier posts (or a photo's tags) each model gets to give different ones (`resetRounds()`
 * forgets them). `results[key][modelId]` is `{ status: 'loading' |
 * 'done' | 'error', items, error }`, keyed by TEXT_KEY or the photo's asset id, and `isRunning`
 * while any is loading. `taps[key][modelId][index]` is a tweet's thumbs up (0, 1 or 2, an
 * outstanding one) or a tag's mark as fitting (0 or 1) this round; `toggle(key, modelId, index)`
 * steps one on and adds the change to the model's score. `toggle` is stable, so memoized rows keep it.
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
  // Each model's posts (or tags of a photo, by results key) of its rounds with `prompt`, so a new
  // round with the same prompt asks for different ones; a new prompt, resetRounds or closing the
  // compare starts over.
  const earlierRef = useRef({ prompt: null, byKey: {} });
  // The rounds with the same prompt, this one included.
  const [promptRound, setPromptRound] = useState(0);

  useEffect(() => () => controllerRef.current?.abort(), []);

  // The steps of a round, each asked of every model: its results key, the results' items key, and
  // its body. Each model gets its own earlier answers to the step with this prompt, and its new ones
  // join them once in.
  function jobsFor({ prompt, photos }) {
    const isSamePrompt = earlierRef.current.prompt === prompt;
    if (!isSamePrompt) earlierRef.current = { prompt, byKey: {} };
    setPromptRound((current) => (isSamePrompt ? current + 1 : 1));
    const { byKey } = earlierRef.current;
    const steps =
      kind === 'vision'
        ? photos.map((asset) => ({
            key: asset.id,
            itemsKey: 'tags',
            body: async (signal) => ({
              prompt,
              image: await readVisionImageAsync(asset, { ...imageDeps, signal }),
            }),
          }))
        : [{ key: TEXT_KEY, itemsKey: 'tweets', body: async () => ({ prompt }) }];
    return steps.map((step) => {
      const atStart = { ...byKey[step.key] };
      // A photo's tags already shown in its earlier rounds, by any model: only new ones are listed,
      // so a model that repeats itself doesn't earn its thumbs up again.
      const seen = new Set(Object.values(atStart).flatMap((rounds) => rounds.flat().map(tagKey)));
      return {
        ...step,
        newOnly: kind === 'vision' ? (items) => items.filter((tag) => !seen.has(tagKey(tag))) : (items) => items,
        earlierFor: (modelId) => atStart[modelId] ?? [],
        onDone: (modelId, items) => {
          byKey[step.key] = { ...byKey[step.key], [modelId]: [...(byKey[step.key]?.[modelId] ?? []), items] };
        },
      };
    });
  }

  function markTriedOnce(results) {
    const tried = triedRef.current;
    const newlyTried = Object.keys(results).filter((id) => results[id].status === 'done' && !tried.has(id));
    if (newlyTried.length === 0) return;
    newlyTried.forEach((id) => tried.add(id));
    markTried(getDb(), kind, newlyTried).catch((error) => console.error('Saving the score failed', error));
  }

  // Each model works through the steps on its own, one request at a time, so its cards fill as soon
  // as it answers and a slow model doesn't hold up the others. A step's body (a photo) is read once.
  async function run(jobs, signal) {
    const bodies = new Map();
    function bodyOf(job) {
      if (!bodies.has(job.key)) bodies.set(job.key, job.body(signal));
      return bodies.get(job.key);
    }
    async function worker(modelId) {
      for (const job of jobs) {
        if (signal.aborted) return;
        let body;
        try {
          body = await bodyOf(job);
        } catch (error) {
          if (!signal.aborted) land(job.key, { [modelId]: { status: 'error', error: apiErrorMessage(error) } });
          continue;
        }
        await askModel(job, { ...body, modelIds: [modelId], earlierRounds: job.earlierFor(modelId) }, modelId, signal);
      }
    }
    await Promise.all(modelIds.map(worker));
  }

  async function askModel(job, body, modelId, signal) {
    let results;
    try {
      results = byModel(await compareOnceMoreAsync(kind, body, signal), job.itemsKey);
    } catch (error) {
      results = { [modelId]: { status: 'error', error: apiErrorMessage(error) } };
    }
    if (signal.aborted) return;
    const result = results[modelId];
    if (result?.status === 'done') {
      job.onDone(modelId, result.items);
      results = { ...results, [modelId]: { ...result, items: job.newOnly(result.items) } };
    }
    markTriedOnce(results);
    land(job.key, results);
  }

  // Puts `results` (by model) in the round under `key`, next to the models already there.
  function land(key, results) {
    setRound((current) => ({
      ...current,
      results: { ...current.results, [key]: { ...current.results[key], ...results } },
    }));
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
      const levels = taps[key]?.[modelId] ?? {};
      const level = levels[index] ?? 0;
      // A tweet steps through one thumb up and two (an outstanding one) back to none; a tag is on or off.
      const next = level < (kind === 'vision' ? 1 : 2) ? level + 1 : 0;
      const nextTaps = { ...taps, [key]: { ...taps[key], [modelId]: { ...levels, [index]: next } } };
      tapsRef.current = nextTaps;
      setRound((current) => ({ ...current, taps: nextTaps }));
      haptics.selection();
      addScore(getDb(), kind, modelId, next - level).catch((error) => console.error('Saving the score failed', error));
    },
    [kind, haptics],
  );

  const isRunning = Object.values(round.results).some((byModelId) =>
    Object.values(byModelId).some(({ status }) => status === 'loading'),
  );

  // Forgets the earlier rounds: the next round starts over, as with a new prompt.
  function resetRounds() {
    earlierRef.current = { prompt: null, byKey: {} };
    setPromptRound(0);
  }

  return { ...round, isRunning, promptRound, startRound, resetRounds, toggle };
}

// The same tag in any case and spacing.
function tagKey(tag) {
  return tag.trim().toLowerCase();
}

// A compare request, asked once more when the dev client's tunnel turned it away.
async function compareOnceMoreAsync(kind, body, signal) {
  try {
    return await compareAsync(kind, body, { signal });
  } catch (error) {
    if (error?.response?.status !== 503 || signal.aborted) throw error;
    await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    return compareAsync(kind, body, { signal });
  }
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
