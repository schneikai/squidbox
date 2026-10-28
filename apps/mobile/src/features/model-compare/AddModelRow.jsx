import { memo } from 'react';
import { StyleSheet, TouchableOpacity } from 'react-native';

import ModelSummary from './ModelSummary';
import formatCost from './formatCost';
import isVerifiedModel from './isVerifiedModel';

import Icon from '@/components/Icon';
import { SCREEN_PADDING } from '@/constants';
import { colors, sizes } from '@/styles/designTokens';

// Memoized: a keystroke in the search or an add re-renders only the rows that changed.
export default memo(AddModelRow);

// A Venice model on the Add screen: its summary with the cost, and a check once it's in your list.
// `onAdd(model)` is stable, so the row stays memoized.
function AddModelRow({ model, kind, isAdded, onAdd }) {
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
        isVerified={isVerifiedModel(kind, model)}
        isUncensored={model.isUncensored}
        detail={formatCost(model, kind)}
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
