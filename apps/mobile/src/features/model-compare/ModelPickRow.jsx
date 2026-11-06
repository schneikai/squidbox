import ModelListSummary from './ModelListSummary';

import SelectIndicator from '@/components/SelectIndicator';
import { Row } from '@/components/settings-list/SettingsList';

// A model of your list to tick for a compare, as the list shows it (`yourDefaults` the defaults this
// account uses and `defaults` the published ones, useYourModels').
export default function ModelPickRow({ id, name, model, kind, score, yourDefaults, defaults, isTicked, onToggle }) {
  return (
    <Row
      leading={<SelectIndicator isSelected={isTicked} />}
      label={
        <ModelListSummary
          id={id}
          name={name}
          model={model}
          kind={kind}
          score={score}
          yourDefaults={yourDefaults}
          defaults={defaults}
        />
      }
      size="small"
      onPress={onToggle}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: isTicked }}
    />
  );
}
