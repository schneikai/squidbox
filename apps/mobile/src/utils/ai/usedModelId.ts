import type { AiModelKind, ModelDefaults } from '@squidbox/shared';

import type { PersonaRow } from '@/sync/db/schema';

/**
 * The id of the model of `kind` the assistant uses for this account (`yourDefaults`, useYourDefaults'):
 * the Uncensored default when the persona has adult content, else the Default; null while either
 * loads (`persona` undefined).
 */
export default function usedModelId(
  yourDefaults: ModelDefaults | null | undefined,
  kind: AiModelKind,
  persona: PersonaRow | null | undefined,
): string | null {
  if (!yourDefaults || persona === undefined) return null;
  return yourDefaults[kind][persona?.adultContent ? 'unrestricted' : 'regular'];
}
