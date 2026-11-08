import { type AiModelKind, aiModelKindSchema } from '@squidbox/shared';

import useAvailableParam from '@/hooks/useAvailableParam';

/**
 * The `kind` route param of a model screen (an ai_admin tool), as useAvailableParam gives it: the
 * kind, or null when the screen is leaving (not available, or an unknown kind).
 */
export default function useModelKindParam(): AiModelKind | null {
  return useAvailableParam('kind', aiModelKindSchema, 'ai_admin')?.value ?? null;
}
