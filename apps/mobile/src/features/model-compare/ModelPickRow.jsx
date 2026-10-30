import { Pressable, StyleSheet } from 'react-native';

import ModelListSummary from './ModelListSummary';

import SelectIndicator from '@/components/SelectIndicator';
import { SCREEN_PADDING } from '@/constants';
import { press } from '@/styles/designTokens';

// A model of your list to tick for a compare, as the list shows it (`yourDefaults` the defaults this
// account uses and `defaults` the published ones, useYourModels').
export default function ModelPickRow({ id, name, model, kind, score, yourDefaults, defaults, isTicked, onToggle }) {
  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && press.flat]}
      onPress={onToggle}

      accessibilityRole="checkbox"
      accessibilityState={{ checked: isTicked }}
    >
      <SelectIndicator isSelected={isTicked} />
      <ModelListSummary
        id={id}
        name={name}
        model={model}
        kind={kind}
        score={score}
        yourDefaults={yourDefaults}
        defaults={defaults}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: SCREEN_PADDING,
    paddingVertical: 12,
  },
});
