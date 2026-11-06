import type {
  AiModelKind,
  CompareVisionRequest,
  CompareVisionResponse,
  CompareWritingRequest,
  CompareWritingResponse,
} from '@squidbox/shared';
import { useCallback, useEffect, useRef, useState } from 'react';

import assignLetters, { type ModelLetter } from './assignLetters';

import useHaptics from '@/hooks/useHaptics';
import useVisionImageDeps from '@/hooks/useVisionImageDeps';
import { addScore, markTried } from '@/sync/aiStateRepository';
import { getDb } from '@/sync/db/client';
import type { AssetRow } from '@/sync/db/schema';
import readVisionImageAsync from '@/utils/assets/readVisionImageAsync';
import compareAsync from '@/utils/cloud-api/ai/compareAsync';
import apiErrorMessage from '@/utils/cloud-api/apiErrorMessage';
import errorResponse from '@/utils/cloud-api/errorResponse';
import tagKey from '@/utils/tagKey';

// A request the tunnel of the dev client turned away (503) is asked once more after this pause:
// it never reached the server.
const RETRY_DELAY_MS = 1500;
// The results key of a writing round, which has no photos.
export const TEXT_KEY = 'text';

// A model's answer to one step: the posts (or a photo's tags) once done, or why it failed. Each
// member names the others' fields as absent, so `result?.items` and `result.error` read on any.
export type ModelResult =
  | { status: 'loading'; items?: undefined; error?: undefined }
  | { status: 'done'; items: string[]; error?: undefined }
  | { status: 'error'; items?: undefined; error: string };
// By model id.
export type ModelResults = Record<string, ModelResult>;
// A model's taps on its answers of one step, by the answer's index.
export type TapLevels = Record<number, number>;
// By model id.
export type ModelTaps = Record<string, TapLevels>;

type RoundInput = { prompt: string; photos: readonly AssetRow[] };
// What a step sends besides the models and their earlier rounds.
type CompareBody = Pick<CompareWritingRequest, 'prompt'> | Pick<CompareVisionRequest, 'prompt' | 'image'>;
type CompareJob = {
  key: string;
  body: (signal: AbortSignal) => Promise<CompareBody>;
  shown: (items: string[]) => string[];
  earlierFor: (modelId: string) => string[][];
  onDone: (modelId: string, items: string[]) => void;
};
// Each model's answers of the earlier rounds, by results key and model.
type EarlierByKey = Partial<Record<string, Record<string, string[][]>>>;

/**
 * One blind compare round at a time for `kind` over `modelIds`. `startRound({ prompt })` (writing)
 * or `startRound({ prompt, photos })` (vision, the assets) reshuffles the letters, clears the taps and asks
 * every model again; `number` counts the rounds, and `promptRound` the rounds with the same prompt,
 * whose earlier posts (or a photo's tags) each model gets to give different ones (`resetRounds()`
 * forgets them). `results[key][modelId]` is a ModelResult, keyed by TEXT_KEY or the photo's asset
 * id, and `isRunning`
 * while any is loading. `taps[key][modelId][index]` is a tweet's thumbs up (0, 1 or 2, an
 * outstanding one) or a tag's mark as fitting (0 or 1) this round; `toggle(key, modelId, index)`
 * steps one on and adds the change to the model's score. `toggle` is stable, so memoized rows keep it.
 */
export default function useCompareRound({ kind, modelIds }: { kind: AiModelKind; modelIds: string[] }) {
  const haptics = useHaptics();
  const imageDeps = useVisionImageDeps();
  const [round, setRound] = useState<{
    number: number;
    letters: ModelLetter[];
    results: Record<string, ModelResults>;
    taps: Record<string, ModelTaps>;
  }>({ number: 0, letters: [], results: {}, taps: {} });
  const controllerRef = useRef<AbortController | null>(null);
  // The taps as of the last toggle: two taps before a re-render must see each other.
  const tapsRef = useRef<Record<string, ModelTaps>>({});
  // The models already marked as tried in this compare, so each is written once.
  const triedRef = useRef(new Set<string>());
  // Each model's posts (or tags of a photo, by results key) of its rounds with `prompt`, so a new
  // round with the same prompt asks for different ones; a new prompt, resetRounds or closing the
  // compare starts over.
  const earlierRef = useRef<{ prompt: string | null; byKey: EarlierByKey }>({ prompt: null, byKey: {} });
  // The rounds with the same prompt, this one included.
  const [promptRound, setPromptRound] = useState(0);

  useEffect(() => () => controllerRef.current?.abort(), []);

  // The earlier answers of `prompt`'s rounds, by results key and model: kept while the prompt stays,
  // started over for a new one. Counts this round.
  function earlierRoundsOf(prompt: string) {
    const isSamePrompt = earlierRef.current.prompt === prompt;
    if (!isSamePrompt) earlierRef.current = { prompt, byKey: {} };
    setPromptRound((current) => (isSamePrompt ? current + 1 : 1));
    return earlierRef.current.byKey;
  }

  // The steps of a round, each asked of every model: its results key and its body. Each model gets its own earlier answers to the step (`byKey`, earlierRoundsOf's), and
  // its new ones join them once in.
  function jobsFor({ prompt, photos }: RoundInput, byKey: EarlierByKey): CompareJob[] {
    const steps: Pick<CompareJob, 'key' | 'body'>[] =
      kind === 'vision'
        ? photos.map((asset) => ({
            key: asset.id,
            body: async (signal) => ({
              prompt,
              image: await readVisionImageAsync(asset, { ...imageDeps, signal }),
            }),
          }))
        : [{ key: TEXT_KEY, body: async () => ({ prompt }) }];
    return steps.map((step) => {
      const atStart = { ...byKey[step.key] };
      return {
        ...step,
        shown: kind === 'vision' ? newTagsOnly(atStart) : (items) => items,
        earlierFor: (modelId) => atStart[modelId] ?? [],
        onDone: (modelId, items) => {
          byKey[step.key] = { ...byKey[step.key], [modelId]: [...(byKey[step.key]?.[modelId] ?? []), items] };
        },
      };
    });
  }

  function markTriedOnce(results: ModelResults) {
    const tried = triedRef.current;
    const newlyTried = Object.keys(results).filter((id) => results[id].status === 'done' && !tried.has(id));
    if (newlyTried.length === 0) return;
    newlyTried.forEach((id) => tried.add(id));
    markTried(getDb(), kind, newlyTried).catch((error) => console.error('Saving the score failed', error));
  }

  // Each model works through the steps on its own, one request at a time, so its cards fill as soon
  // as it answers and a slow model doesn't hold up the others. A step's body (a photo) is read once,
  // and let go once every model has sent it.
  async function run(jobs: CompareJob[], signal: AbortSignal) {
    // By step: its body, and how many models are still to send it.
    const bodies = new Map<string, { body: Promise<CompareBody>; waiting: number }>();
    async function bodyFor(job: CompareJob) {
      let step = bodies.get(job.key);
      if (!step) {
        step = { body: job.body(signal), waiting: modelIds.length };
        bodies.set(job.key, step);
      }
      try {
        return await step.body;
      } finally {
        step.waiting -= 1;
        if (step.waiting === 0) bodies.delete(job.key);
      }
    }
    async function worker(modelId: string) {
      for (const job of jobs) {
        if (signal.aborted) return;
        await askModel(job, modelId, () => bodyFor(job), signal);
      }
    }
    await Promise.all(modelIds.map(worker));
  }

  async function askModel(
    job: CompareJob,
    modelId: string,
    bodyAsync: () => Promise<CompareBody>,
    signal: AbortSignal,
  ) {
    let results: ModelResults;
    try {
      const body = { ...(await bodyAsync()), modelIds: [modelId], earlierRounds: job.earlierFor(modelId) };
      results = byModel(await compareOnceMoreAsync(kind, body, signal));
    } catch (error) {
      results = { [modelId]: { status: 'error', error: apiErrorMessage(error) } };
    }
    if (signal.aborted) return;
    const result = results[modelId];
    if (result?.status === 'done') {
      job.onDone(modelId, result.items);
      results = { ...results, [modelId]: { ...result, items: job.shown(result.items) } };
    }
    markTriedOnce(results);
    land(job.key, results);
  }

  // Puts `results` (by model) in the round under `key`, next to the models already there.
  function land(key: string, results: ModelResults) {
    setRound((current) => ({
      ...current,
      results: { ...current.results, [key]: { ...current.results[key], ...results } },
    }));
  }

  function startRound(input: RoundInput) {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    const jobs = jobsFor(input, earlierRoundsOf(input.prompt));
    const loading = Object.fromEntries(
      modelIds.map((modelId): [string, ModelResult] => [modelId, { status: 'loading' }]),
    );
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
    (key: string, modelId: string, index: number) => {
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

export type CompareRoundState = ReturnType<typeof useCompareRound>;

// A photo's tags not shown in its earlier rounds (`earlier`, by model) by any model, so a model
// that repeats itself doesn't earn its thumbs up again.
function newTagsOnly(earlier: Record<string, string[][]>): (tags: string[]) => string[] {
  const seen = new Set(Object.values(earlier).flatMap((rounds) => rounds.flat().map(tagKey)));
  return (tags) => tags.filter((tag) => !seen.has(tagKey(tag)));
}

// A compare request, asked once more when the dev client's tunnel turned it away.
async function compareOnceMoreAsync(
  kind: AiModelKind,
  body: CompareWritingRequest | CompareVisionRequest,
  signal: AbortSignal,
) {
  try {
    return await compareAsync(kind, body, { signal });
  } catch (error) {
    if (errorResponse(error)?.status !== 503 || signal.aborted) throw error;
    await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    return compareAsync(kind, body, { signal });
  }
}

// The server's results by model, done or failed: a model's items are its posts or its tags,
// whichever the answer has.
function byModel(results: CompareWritingResponse['results'] | CompareVisionResponse['results']): ModelResults {
  return Object.fromEntries(
    results.map((result) => [
      result.modelId,
      'error' in result
        ? { status: 'error', error: result.error }
        : { status: 'done', items: 'tweets' in result ? result.tweets : result.tags },
    ]),
  );
}
