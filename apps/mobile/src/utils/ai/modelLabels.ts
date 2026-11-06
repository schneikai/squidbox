import {
  type AiModelKind,
  type ApiAiModel,
  MODEL_DEFAULT_LABELS,
  MODEL_DEFAULT_VARIANTS,
  type ModelDefaults,
  type ModelLabel,
} from '@squidbox/shared';

import isVerifiedModel from '@/utils/ai/isVerifiedModel';

export type ModelLabels = Record<ModelLabel | 'changed', boolean>;

/**
 * The labels the model `modelId` has for `kind` (`model` its catalog model, null once Venice
 * dropped it; `yourDefaults` the defaults this account uses, useYourModels'), by
 * MODEL_LABEL_NAMES' keys: `verified`, `uncensored` (its resolved Uncensored label), `default` and
 * `uncensoredDefault`. Each is a flag of its own: a default may be unverified or not uncensored. A
 * dropped model keeps only its defaults (they're by id); all false while the defaults load. With
 * the published `defaults` (useYourModels'), `changed` is whether it is a default of yours that
 * everyone doesn't use; without them it is false.
 */
export default function modelLabels(
  kind: AiModelKind,
  modelId: string,
  model: ApiAiModel | null,
  yourDefaults: ModelDefaults | null | undefined,
  defaults?: ModelDefaults | null,
): ModelLabels {
  if (!yourDefaults) {
    return { verified: false, uncensored: false, default: false, uncensoredDefault: false, changed: false };
  }
  return {
    changed:
      !!defaults &&
      MODEL_DEFAULT_VARIANTS.some(
        (variant) => yourDefaults[kind][variant] === modelId && defaults[kind][variant] !== modelId,
      ),
    verified: model ? isVerifiedModel(kind, model) : false,
    uncensored: model ? model.isUncensored : false,
    default: yourDefaults[kind][MODEL_DEFAULT_LABELS.default] === modelId,
    uncensoredDefault: yourDefaults[kind][MODEL_DEFAULT_LABELS.uncensoredDefault] === modelId,
  };
}
