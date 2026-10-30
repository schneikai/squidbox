import ModelListSummary from './ModelListSummary';

import { Row } from '@/components/settings-list/SettingsList';

/**
 * A model in your list: its summary with the labels, score, cost and note, and a chevron: a tap opens its
 * page (`onOpen`). `model` null is a model Venice no longer offers: greyed, its page still opens
 * (to remove it). `yourDefaults` the defaults this account uses and `defaults` the published ones
 * (useYourModels').
 */
export default function ModelRow({ id, name, model, kind, score, note, yourDefaults, defaults, onOpen }) {
  return (
    <Row
      label={
        <ModelListSummary
          id={id}
          name={name}
          model={model}
          kind={kind}
          score={score}
          note={note}
          yourDefaults={yourDefaults}
          defaults={defaults}
        />
      }
      onPress={onOpen}
      hasChevron
      size="small"
    />
  );
}
