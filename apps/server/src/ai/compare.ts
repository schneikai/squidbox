// A blind compare runs the same task on several models at once. Each model's result stands on its
// own: one failing leaves the others' results.
import type { CatalogEntry } from './catalog.js';
import { runTask, type AiTask } from './tasks.js';
import { VeniceError, type ChatMessage } from './venice.js';

type Logger = { error: (object: unknown, message: string) => void };

/**
 * Sends the same messages to every model at once; each gets its result or its own error, which
 * never names the model (the compare is blind). `signal` stops the calls still running.
 */
export async function compareModels<T>({
  task,
  messages,
  models,
  log,
  signal,
}: {
  task: AiTask<T>;
  messages: ChatMessage[];
  models: CatalogEntry[];
  log?: Logger;
  signal?: AbortSignal;
}): Promise<((T & { modelId: string }) | { modelId: string; error: string })[]> {
  const settled = await Promise.allSettled(
    models.map(async (model) => ({ modelId: model.id, ...(await runTask({ task, messages, model, signal })) })),
  );
  return settled.map((result, index) => {
    const model = models[index]!;
    const modelId = model.id;
    if (result.status === 'fulfilled') return result.value;
    if (result.reason instanceof VeniceError) return { modelId, error: withoutModelName(result.reason.message, model) };
    log?.error({ err: result.reason, modelId }, 'AI compare failed');
    return { modelId, error: 'Something went wrong' };
  });
}

// Venice's own error texts can name the model ("kimi-k3 is at capacity"), which would unblind it.
function withoutModelName(message: string, model: CatalogEntry): string {
  return [model.id, model.model_spec.name].reduce(
    (text, name) => text.replace(new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), 'the model'),
    message,
  );
}
