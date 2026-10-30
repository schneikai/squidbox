import { Alert } from 'react-native';

import applyAiCatalog from '@/lib/applyAiCatalog';
import createStore from '@/lib/createStore';
import setUncensoredAsync from '@/utils/cloud-api/ai/setUncensoredAsync';
import apiErrorMessage from '@/utils/cloud-api/apiErrorMessage';

// The Uncensored marks tapped in a compare and not yet on the server, by model id: every card of a
// model (vision has one per photo) shows the same one.
const wanted = createStore({});
// One write at a time, for every model: each answer is the whole catalog, so a later write's answer
// is always the newer one.
let queue = Promise.resolve();

/**
 * Marks the catalog model `model` uncensored or not (`isOn`) at once, before the server has it.
 * `onError` runs when the write failed, the mark back as it was.
 */
function set(model, isOn, onError) {
  wanted.set((current) => ({ ...current, [model.id]: isOn }));
  queue = queue.then(async () => {
    const next = wanted.get()[model.id];
    if (next === undefined) return;
    try {
      // Back to following Venice when it agrees.
      applyAiCatalog(await setUncensoredAsync(model.id, next === model.isVeniceUncensored ? null : next));
      // A tap made meanwhile has its own write queued after this one.
      if (wanted.get()[model.id] === next) forget(model.id);
    } catch (error) {
      forget(model.id);
      onError(error);
    }
  });
}

function forget(modelId) {
  wanted.set(({ [modelId]: _, ...rest }) => rest);
}

/** An alert for a failed write, the switch on the model's page's. */
function alertFailed(error) {
  Alert.alert("Couldn't change the label", apiErrorMessage(error));
}

/** `wanted` (a store of `{ [modelId]: isOn }`), `set(model, isOn, onError)` and `alertFailed(error)`. */
const uncensoredMarks = { wanted, set, alertFailed };

export default uncensoredMarks;
