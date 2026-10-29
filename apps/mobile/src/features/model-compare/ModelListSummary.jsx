import ModelSummary from './ModelSummary';

import modelDetailText from '@/utils/ai/modelDetailText';
import modelLabels from '@/utils/ai/modelLabels';

/**
 * A model of your list as the list and the compare's pick step show it: its name with its labels
 * over its score, cost and reasoning (`yourDefaults` the defaults this account uses, useYourModels', for the Default labels). `model` null
 * is one Venice no longer offers: greyed, so labelled.
 */
export default function ModelListSummary({ name, model, kind, score, yourDefaults }) {
  const isAvailable = model !== null;
  return (
    <ModelSummary
      name={name}
      labels={modelLabels(kind, model?.id ?? null, model, yourDefaults)}
      detail={isAvailable ? modelDetailText(model, kind, score) : 'No longer available'}
      isDimmed={!isAvailable}
    />
  );
}
