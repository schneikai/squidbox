import { memo } from 'react';
import { StyleSheet, TouchableOpacity } from 'react-native';

import ModelSummary from './ModelSummary';

import Icon from '@/components/Icon';
import { SCREEN_PADDING } from '@/constants';
import { colors, sizes } from '@/styles/designTokens';
import modelDetailText from '@/utils/ai/modelDetailText';
import modelLabels from '@/utils/ai/modelLabels';

// Memoized: a keystroke in the search or an add re-renders only the rows that changed.
export default memo(AddModelRow);

// A Venice model on the Add screen: its summary with its labels, cost and reasoning, and a check once
// it's in your list (its labels from `yourDefaults`, the defaults this account uses). `onAdd(model)`
// is stable, so the row stays memoized.
function AddModelRow({ model, kind, yourDefaults, isAdded, onAdd }) {
  return (
    <TouchableOpacity
      style={styles.row}
      onPress={() => onAdd(model)}
      disabled={isAdded}
      activeOpacity={0.6}
      accessibilityRole="button"
      accessibilityState={{ selected: isAdded }}
    >
      <ModelSummary
        name={model.name}
        labels={modelLabels(kind, model.id, model, yourDefaults)}
        detail={modelDetailText(model, kind)}
      />
      {isAdded && <Icon name="check" size={sizes.icon} color={colors.accent.base} />}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: SCREEN_PADDING,
    paddingVertical: 12,
  },
});
