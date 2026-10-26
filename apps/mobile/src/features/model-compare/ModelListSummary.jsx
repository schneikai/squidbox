import ModelSummary from './ModelSummary';
import formatCost from './formatCost';
import scoreText from './scoreText';

import useHasFeature from '@/hooks/useHasFeature';

/**
 * A model of your list as the list and the compare's pick step show it: its name and Uncensored
 * label over its score and cost. `model` null is one Venice no longer offers: greyed, so labelled.
 * The score shows only to an ai_admin account (it comes from Compare).
 */
export default function ModelListSummary({ name, model, kind, score }) {
  const isScored = useHasFeature('ai_admin');
  const isAvailable = model !== null;
  const cost = isAvailable ? formatCost(model, kind) : 'No longer available';
  return (
    <ModelSummary
      name={name}
      isUncensored={model?.isUncensored}
      detail={isScored ? `${scoreText(score, kind)} · ${cost}` : cost}
      detailIcon={isScored && kind === 'writing' && score !== null ? 'thumbs-up' : null}
      isDimmed={!isAvailable}
    />
  );
}
