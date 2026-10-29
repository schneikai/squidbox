import { aiModelKindSchema, MODEL_LABEL_NAMES, type AiModelKind, type ModelDefaults } from './contracts/ai';
import type { LabelLock } from './verifiedLock';

const KIND_NAMES: Record<AiModelKind, string> = { writing: 'Writing', vision: 'Vision' };

/**
 * Unrestricted stays on while the model is the Default for Adult content of any kind; the name has
 * that kind unless it is `kind` (null: the caller has no kind, so it is always named).
 */
export function unrestrictedLock(kind: AiModelKind | null, modelId: string, defaults: ModelDefaults): LabelLock {
  // The kind it is the Default for Adult content of, `kind` first.
  const adultKind = [kind, ...aiModelKindSchema.options].find(
    (each): each is AiModelKind => each !== null && defaults[each].unrestricted === modelId,
  );
  if (!adultKind) return { defaultName: null };
  const named = adultKind !== kind ? `${KIND_NAMES[adultKind]} ` : '';
  return { defaultName: `${named}${MODEL_LABEL_NAMES.adultDefault}` };
}
