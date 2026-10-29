import { StyleSheet, TouchableOpacity } from 'react-native';

import ModelListSummary from './ModelListSummary';

import Icon from '@/components/Icon';
import { SCREEN_PADDING } from '@/constants';
import { colors, sizes } from '@/styles/designTokens';

/**
 * A model in your list: its summary with the labels, score and cost, a check when it's the chosen
 * one, and a chevron: a tap opens its page (`onOpen`). `model` null is a model Venice no longer
 * offers: greyed, its page still opens (to remove it). `defaults` useAiCatalog's.
 */
export default function ModelRow({ name, model, kind, score, defaults, isChosen, onOpen }) {
  return (
    <TouchableOpacity
      style={styles.row}
      onPress={onOpen}
      activeOpacity={0.6}
      accessibilityRole="button"
      accessibilityState={{ selected: isChosen }}
    >
      <ModelListSummary name={name} model={model} kind={kind} score={score} defaults={defaults} />
      {isChosen && <Icon name="check" size={sizes.icon} color={colors.accent.base} />}
      <Icon name="chevron-right" size={sizes.iconSmall} color={colors.text.tertiary} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: SCREEN_PADDING,
    paddingRight: 12,
    paddingVertical: 12,
  },
});
