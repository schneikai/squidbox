import type { ApiAiModel } from '@squidbox/shared';

/** A catalog model as the server sends it, `over` on neutral defaults. */
export function makeApiModel(over: Partial<ApiAiModel> = {}): ApiAiModel {
  return {
    id: 'model',
    name: 'Model',
    supportsVision: false,
    isUncensored: false,
    isVeniceUncensored: false,
    verifiedKinds: [],
    uncensoredOverride: null,
    reasoning: { supported: false, defaultEffort: null },
    costPerReplyUsd: 0.001,
    costPer100PhotosUsd: null,
    ...over,
  };
}
