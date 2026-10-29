import ModelSummary from './ModelSummary';

import useAiCatalog from '@/hooks/useAiCatalog';
import useHasFeature from '@/hooks/useHasFeature';
import modelDetailText from '@/utils/ai/modelDetailText';
import modelLabels from '@/utils/ai/modelLabels';

/**
 * A model of your list as the list and the compare's pick step show it: its name with its labels
 * over its score, cost and thinking. `model` null is one Venice no longer offers: greyed, so
 * labelled. The score shows only to an ai_admin account (it comes from Compare).
 */
export default function ModelListSummary({ name, model, kind, score }) {
  const isScored = useHasFeature('ai_admin');
  const { defaults } = useAiCatalog();
  const isAvailable = model !== null;
  return (
    <ModelSummary
      name={name}
      labels={modelLabels(kind, model, defaults)}
      detail={isAvailable ? modelDetailText(model, kind, isScored ? score : undefined) : 'No longer available'}
      isDimmed={!isAvailable}
    />
  );
}
