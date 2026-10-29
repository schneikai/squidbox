import { StyleSheet, Text, TouchableOpacity } from 'react-native';

import ModelListSummary from './ModelListSummary';

import SelectIndicator from '@/components/SelectIndicator';
import { SCREEN_PADDING } from '@/constants';
import { colors, typography } from '@/styles/designTokens';

// A model of your list to tick for a compare, as the list shows it, with "Current" on the one this
// account uses (`yourDefaults` the defaults it uses and `defaults` the published ones,
// useYourModels').
export default function ModelPickRow({
  id,
  name,
  model,
  kind,
  score,
  yourDefaults,
  defaults,
  isTicked,
  isCurrent,
  onToggle,
}) {
  return (
    <TouchableOpacity
      style={styles.row}
      onPress={onToggle}
      activeOpacity={0.6}
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
      {isCurrent && <Text style={styles.current}>Current</Text>}
    </TouchableOpacity>
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
  current: {
    fontSize: typography.subheadline,
    color: colors.text.secondary,
  },
});
