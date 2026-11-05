import type { AiModelKind, ApiAiModel } from '@squidbox/shared';

/** What one unit of `model`'s work for `kind` costs in US dollars: a reply, or for vision a photo. */
export default function unitCostUsd(model: ApiAiModel, kind: AiModelKind): number {
  // A model that can't see photos has no cost per photo (null): 0, as null / 100 always gave.
  return kind === 'vision' ? (model.costPer100PhotosUsd ?? 0) / 100 : model.costPerReplyUsd;
}
