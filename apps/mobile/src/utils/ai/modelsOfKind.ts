import type { AiModelKind, ApiAiModel } from '@squidbox/shared';

/** The catalog's models a kind can use: all for writing, those that see photos for vision. */
export default function modelsOfKind<M extends Pick<ApiAiModel, 'supportsVision'>>(
  catalog: readonly M[],
  kind: AiModelKind,
): readonly M[] {
  return kind === 'vision' ? catalog.filter((model) => model.supportsVision) : catalog;
}
