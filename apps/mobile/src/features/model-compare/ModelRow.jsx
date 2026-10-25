import { StyleSheet, TouchableOpacity, View } from 'react-native';

import ModelSummary from './ModelSummary';
import formatCost from './formatCost';
import scoreText from './scoreText';

import Icon from '@/components/Icon';
import IconMenuButton from '@/components/IconMenuButton';
import MenuOption from '@/components/popup-menu-options/MenuOption';
import { SCREEN_PADDING } from '@/constants';
import { colors, sizes } from '@/styles/designTokens';

/**
 * A model in your list: its summary with the score and cost, a check when it's the chosen one, and
 * a menu to remove it. `model` null is a model Venice no longer offers: greyed, not choosable, its
 * score kept.
 */
export default function ModelRow({ name, model, kind, score, isChosen, onChoose, onRemove }) {
  const isAvailable = model !== null;

  return (
    <View style={styles.row}>
      <TouchableOpacity
        style={styles.main}
        onPress={onChoose}
        disabled={!isAvailable}
        activeOpacity={0.6}
        accessibilityRole="button"
        accessibilityState={{ selected: isChosen, disabled: !isAvailable }}
      >
        <ModelSummary
          name={name}
          isUncensored={model?.isUncensored}
          detail={`${scoreText(score, kind)} · ${isAvailable ? formatCost(model, kind) : 'No longer available'}`}
          detailIcon={kind === 'writing' && score > 0 ? 'thumbs-up' : null}
          isDimmed={!isAvailable}
        />
        {isChosen && <Icon name="check" size={sizes.icon} color={colors.accent.base} />}
      </TouchableOpacity>
      <IconMenuButton accessibilityLabel={`${name} options`} color={colors.text.secondary}>
        <MenuOption label="Remove" icon="trash" onPress={onRemove} />
      </IconMenuButton>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 4,
  },
  main: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: SCREEN_PADDING,
    paddingVertical: 12,
  },
});
