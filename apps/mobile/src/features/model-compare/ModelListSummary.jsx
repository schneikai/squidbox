import ModelSummary from './ModelSummary';
import formatCost from './formatCost';
import scoreText from './scoreText';

/**
 * A model of your list as the list and the compare's pick step show it: its name and Uncensored
 * label over its score and cost. `model` null is one Venice no longer offers: greyed, so labelled.
 */
export default function ModelListSummary({ name, model, kind, score }) {
  const isAvailable = model !== null;
  return (
    <ModelSummary
      name={name}
      isUncensored={model?.isUncensored}
      detail={`${scoreText(score, kind)} · ${isAvailable ? formatCost(model, kind) : 'No longer available'}`}
      detailIcon={kind === 'writing' && score !== null ? 'thumbs-up' : null}
      isDimmed={!isAvailable}
    />
  );
}
