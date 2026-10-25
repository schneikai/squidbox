import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import UncensoredBadge from './UncensoredBadge';
import formatCost from './formatCost';
import scoreText from './scoreText';

import Icon from '@/components/Icon';
import IconMenuButton from '@/components/IconMenuButton';
import MenuOption from '@/components/popup-menu-options/MenuOption';
import { SCREEN_PADDING } from '@/constants';
import { colors, sizes, typography } from '@/styles/designTokens';

/**
 * A model in your list: name, Uncensored badge, score and cost line, a check when it's the chosen
 * one, and a menu to remove it. `row.model` null is a model Venice no longer offers: greyed, not
 * choosable, its score kept.
 */
export default function ModelRow({ row, kind, score, isChosen, onChoose, onRemove }) {
  const { name, model } = row;
  const isAvailable = model !== null;
  const cost = isAvailable && formatCost(kind === 'vision' ? model.costPer100PhotosUsd : model.costPerReplyUsd, kind);
  const showThumb = kind === 'writing' && score > 0;

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
        <View style={styles.text}>
          <View style={styles.titleLine}>
            <Text style={[styles.name, !isAvailable && styles.unavailable]}>{name}</Text>
            {model?.isUncensored && <UncensoredBadge />}
          </View>
          <View style={styles.detailLine}>
            {showThumb && <Icon name="thumbs-up" size={typography.subheadline} color={colors.text.secondary} />}
            <Text style={[styles.detail, !isAvailable && styles.unavailable]} numberOfLines={1}>
              {scoreText(score, kind)} · {isAvailable ? cost : 'No longer available'}
            </Text>
          </View>
        </View>
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
  text: {
    flex: 1,
    gap: 4,
  },
  titleLine: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: 8,
    rowGap: 4,
  },
  name: {
    flexShrink: 1,
    fontSize: typography.body,
    color: colors.text.primary,
  },
  detailLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  detail: {
    flexShrink: 1,
    fontSize: typography.subheadline,
    color: colors.text.secondary,
  },
  unavailable: {
    color: colors.text.tertiary,
  },
});
