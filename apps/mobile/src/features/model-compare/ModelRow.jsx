import { StyleSheet, TouchableOpacity } from 'react-native';

import ModelListSummary from './ModelListSummary';

import Icon from '@/components/Icon';
import { SCREEN_PADDING } from '@/constants';
import { colors, sizes } from '@/styles/designTokens';

/**
 * A model in your list: its summary with the labels, score and cost, and a chevron: a tap opens its
 * page (`onOpen`). `model` null is a model Venice no longer offers: greyed, its page still opens
 * (to remove it). `yourDefaults` the defaults this account uses and `defaults` the published ones
 * (useYourModels').
 */
export default function ModelRow({ name, model, kind, score, yourDefaults, defaults, onOpen }) {
  return (
    <TouchableOpacity style={styles.row} onPress={onOpen} activeOpacity={0.6} accessibilityRole="button">
      <ModelListSummary
        name={name}
        model={model}
        kind={kind}
        score={score}
        yourDefaults={yourDefaults}
        defaults={defaults}
      />
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
