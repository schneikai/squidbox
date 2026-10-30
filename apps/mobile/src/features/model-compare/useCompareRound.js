import { useCallback, useEffect, useRef, useState } from 'react';

import assignLetters from './assignLetters';

import useHaptics from '@/hooks/useHaptics';
import useVisionImageDeps from '@/hooks/useVisionImageDeps';
import { addScore, markTried } from '@/sync/aiStateRepository';
import { getDb } from '@/sync/db/client';
import readVisionImageAsync from '@/utils/assets/readVisionImageAsync';
import compareAsync from '@/utils/cloud-api/ai/compareAsync';
import apiErrorMessage from '@/utils/cloud-api/apiErrorMessage';

// Photos asked at once in a vision round, each of them of every model at once.
const CONCURRENCY = 2;
// The results key of a writing round, which has no photos.
export const TEXT_KEY = 'text';

/**
 * One blind compare round at a time for `kind` over `modelIds`. `startRound({ prompt })` (writing)
 * or `startRound({ prompt, photos })` (vision, the assets) reshuffles the letters, clears the taps and asks
 * every model again; `number` counts the rounds, and `promptRound` the writing rounds with the same
 * prompt, whose earlier posts each model gets to write different ones (`resetRounds()` forgets them). `results[key][modelId]` is `{ status: 'loading' |
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
  // Writing: each model's posts of its rounds with `prompt`, so New suggestions with the same prompt
  // asks for different ones; a new prompt, resetRounds or closing the compare starts over.
  const earlierRef = useRef({ prompt: null, byModel: {} });
  // The rounds with the same prompt, this one included (writing).
  const [promptRound, setPromptRound] = useState(0);

  useEffect(() => () => controllerRef.current?.abort(), []);

  function failAll(error) {
    const message = apiErrorMessage(error);
    return Object.fromEntries(modelIds.map((modelId) => [modelId, { status: 'error', error: message }]));
  }

  // One step of a round, asked of every model: its results key, the results' items key, and its body.
  function jobsFor({ prompt, photos }) {
    if (kind !== 'vision') return [writingJob(prompt)];
    return photos.map((asset) => ({
      key: asset.id,
      itemsKey: 'tags',
      body: async (signal) => ({
        prompt,
        image: await readVisionImageAsync(asset, { ...imageDeps, signal }),
      }),
    }));
  }

  // The writing round's one step: each model gets its own earlier posts with this prompt, and its
  // new ones join them once in.
  function writingJob(prompt) {
    const isSamePrompt = earlierRef.current.prompt === prompt;
    if (!isSamePrompt) earlierRef.current = { prompt, byModel: {} };
    setPromptRound((current) => (isSamePrompt ? current + 1 : 1));
    const earlier = earlierRef.current;
    const atStart = { ...earlier.byModel };
    return {
      key: TEXT_KEY,
      itemsKey: 'tweets',
      body: async () => ({ prompt }),
      extraFor: (modelId) => ({ earlierRounds: atStart[modelId] ?? [] }),
      onDone: (modelId, posts) => {
        earlier.byModel[modelId] = [...(earlier.byModel[modelId] ?? []), posts];
      },
    };
  }

  function markTriedOnce(results) {
    const tried = triedRef.current;
    const newlyTried = Object.keys(results).filter((id) => results[id].status === 'done' && !tried.has(id));
    if (newlyTried.length === 0) return;
    newlyTried.forEach((id) => tried.add(id));
    markTried(getDb(), kind, newlyTried).catch((error) => console.error('Saving the score failed', error));
  }

  // Each model is asked on its own, so its card fills as soon as it answers.
  async function run(jobs, signal) {
    const queue = [...jobs];
    async function worker() {
      while (queue.length > 0 && !signal.aborted) {
        const job = queue.shift();
        let body;
        try {
          body = await job.body(signal);
        } catch (error) {
          if (!signal.aborted) land(job.key, failAll(error));
          continue;
        }
        await Promise.all(modelIds.map((modelId) => askModel(job, { ...body, modelIds: [modelId] }, modelId, signal)));
      }
    }
    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  }

  async function askModel(job, body, modelId, signal) {
    let results;
    try {
      results = byModel(await compareAsync(kind, { ...body, ...job.extraFor?.(modelId) }, { signal }), job.itemsKey);
    } catch (error) {
      results = { [modelId]: { status: 'error', error: apiErrorMessage(error) } };
    }
    if (signal.aborted) return;
    if (results[modelId]?.status === 'done') job.onDone?.(modelId, results[modelId].items);
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
    earlierRef.current = { prompt: null, byModel: {} };
    setPromptRound(0);
  }

  return { ...round, isRunning, promptRound, startRound, resetRounds, toggle };
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
