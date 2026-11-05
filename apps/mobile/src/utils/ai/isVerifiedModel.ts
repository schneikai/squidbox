import type { AiModelKind, ApiAiModel } from '@squidbox/shared';

/** Whether Squidbox verified the model (a catalog model) for this kind: the server's marks. */
export default function isVerifiedModel(kind: AiModelKind, model: ApiAiModel): boolean {
  return model.verifiedKinds.includes(kind);
}
