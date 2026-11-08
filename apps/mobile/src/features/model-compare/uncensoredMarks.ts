import type { ApiAiModel } from '@squidbox/shared';
import { Alert } from 'react-native';

import applyAiCatalog from '@/lib/applyAiCatalog';
import createStore from '@/lib/createStore';
import setUncensoredAsync from '@/utils/cloud-api/ai/setUncensoredAsync';
import apiErrorMessage from '@/utils/cloud-api/apiErrorMessage';

// The Uncensored marks tapped in a compare and not yet on the server, by model id: every card of a
// model (vision has one per photo) shows the same one.
const wanted = createStore<Partial<Record<string, boolean>>>({});
// One write at a time, for every model: each answer is the whole catalog, so a later write's answer
// is always the newer one.
let queue: Promise<void> = Promise.resolve();
// The last tap on each model, by model id: a write forgets the mark only while it is the tap it sent.
const lastTaps = new Map<string, number>();
let tapCount = 0;

/**
 * Marks the catalog model `model` uncensored or not (`isOn`) at once, before the server has it.
 * `onError` runs when the write failed, the mark back as it was unless a tap came after the one the
 * write sent (that tap keeps its mark and has its own write).
 */
function set(
  model: Pick<ApiAiModel, 'id' | 'isVeniceUncensored'>,
  isOn: boolean,
  onError: (error: unknown) => void,
): void {
  wanted.set((current) => ({ ...current, [model.id]: isOn }));
  lastTaps.set(model.id, ++tapCount);
  queue = queue.then(async () => {
    const next = wanted.get()[model.id];
    if (next === undefined) return;
    // The mark sent is the last tap's.
    const tap = lastTaps.get(model.id);
    try {
      // Back to following Venice when it agrees.
      applyAiCatalog(await setUncensoredAsync(model.id, next === model.isVeniceUncensored ? null : next));
    } catch (error) {
      onError(error);
    } finally {
      // A tap made meanwhile keeps its mark and has its own write queued after this one.
      if (lastTaps.get(model.id) === tap) forget(model.id);
    }
  });
}

function forget(modelId: string) {
  lastTaps.delete(modelId);
  wanted.set(({ [modelId]: _, ...rest }) => rest);
}

/** An alert for a failed write, the switch on the model's page's. */
function alertFailed(error: unknown) {
  Alert.alert("Couldn't change the label", apiErrorMessage(error));
}

/** `wanted` (a store of `{ [modelId]: isOn }`), `set(model, isOn, onError)` and `alertFailed(error)`. */
const uncensoredMarks = { wanted, set, alertFailed };

export default uncensoredMarks;
