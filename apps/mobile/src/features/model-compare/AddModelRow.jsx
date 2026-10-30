import { memo } from 'react';

import ModelSummary from './ModelSummary';

import { Row } from '@/components/settings-list/SettingsList';
import modelDetailText from '@/utils/ai/modelDetailText';
import modelLabels from '@/utils/ai/modelLabels';

// Memoized: a keystroke in the search or an add re-renders only the rows that changed.
export default memo(AddModelRow);

// A Venice model on the Add screen: its summary with its labels, cost and reasoning, and a check once
// it's in your list (its labels from `yourDefaults`, the defaults this account uses, and `defaults`,
// the published ones). A model you removed shows its score and note (`removed`), so you see it was
// tried. `onAdd(model)` is stable, so the row stays memoized.
function AddModelRow({ model, kind, yourDefaults, defaults, removed, isAdded, onAdd }) {
  return (
    <Row
      label={
        <ModelSummary
          name={model.name}
          labels={modelLabels(kind, model.id, model, yourDefaults, defaults)}
          detail={modelDetailText(model, kind)}
          score={removed?.score}
          note={removed?.note}
        />
      }
      onPress={() => onAdd(model)}
      disabled={isAdded}
      isSelected={isAdded}
      size="small"
    />
  );
}
