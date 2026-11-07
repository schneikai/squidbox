import type { AiModelKind } from '@squidbox/shared';

import ModelSummary from './ModelSummary';

import type { YourDefaults } from '@/hooks/useYourDefaults';
import type { YourModelRow } from '@/hooks/useYourModels';
import modelDetailText from '@/utils/ai/modelDetailText';
import modelLabels from '@/utils/ai/modelLabels';

export type ModelListSummaryProps = Pick<YourModelRow, 'id' | 'name' | 'model' | 'score'> &
  Partial<Pick<YourModelRow, 'note'>> &
  Pick<YourDefaults, 'defaults' | 'yourDefaults'> & { kind: AiModelKind };

/**
 * A model of your list (`id`) as the list and the compare's pick step show it: its name with its
 * labels over its score, cost and reasoning, and its `note` if any (`yourDefaults` the defaults this account uses,
 * useYourModels', for the Default labels; with the published `defaults`, Changed on a default of
 * yours that differs). `model` null is one Venice no longer offers: greyed, so labelled.
 */
export default function ModelListSummary({
  id,
  name,
  model,
  kind,
  score,
  note,
  yourDefaults,
  defaults,
}: ModelListSummaryProps) {
  const isAvailable = model !== null;
  return (
    <ModelSummary
      name={name}
      labels={modelLabels(kind, id, model, yourDefaults, defaults)}
      detail={isAvailable ? modelDetailText(model, kind) : 'No longer available'}
      score={isAvailable ? score : undefined}
      note={note}
      isDimmed={!isAvailable}
    />
  );
}
