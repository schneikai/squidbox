import type { AiModelKind, ApiAiModel } from '@squidbox/shared';

import centsText from '@/utils/ai/centsText';
import unitCostUsd from '@/utils/ai/unitCostUsd';

/** A model's cost line for its kind, in cents: "0.04¢ a reply", "0.02¢ a photo". */
export default function formatCost(model: ApiAiModel, kind: AiModelKind): string {
  return `${centsText(unitCostUsd(model, kind))} ${kind === 'vision' ? 'a photo' : 'a reply'}`;
}
