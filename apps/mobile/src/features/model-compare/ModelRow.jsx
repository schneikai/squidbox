import { StyleSheet, TouchableOpacity, View } from 'react-native';

import ModelListSummary from './ModelListSummary';

import Icon from '@/components/Icon';
import IconMenuButton from '@/components/IconMenuButton';
import MenuDivider from '@/components/popup-menu-options/MenuDivider';
import MenuOption from '@/components/popup-menu-options/MenuOption';
import { SCREEN_PADDING } from '@/constants';
import VerificationMenuOptions from '@/features/model-verify/VerificationMenuOptions';
import useHasFeature from '@/hooks/useHasFeature';
import { colors, sizes } from '@/styles/designTokens';

/**
 * A model in your list: its summary with the score and cost, a check when it's the chosen one, and
 * a menu to run its check, set its marks, reset its score or remove it. `model` null is a model Venice
 * no longer offers: greyed, not choosable, its score kept. The check, the marks, the score and its
 * reset are only for an ai_admin account.
 */
export default function ModelRow({ name, model, kind, score, isChosen, onChoose, onCheck, onResetScore, onRemove }) {
  const isAiAdmin = useHasFeature('ai_admin');
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
        <ModelListSummary name={name} model={model} kind={kind} score={score} />
        {isChosen && <Icon name="check" size={sizes.icon} color={colors.accent.base} />}
      </TouchableOpacity>
      <IconMenuButton accessibilityLabel={`${name} options`} color={colors.text.secondary}>
        {isAiAdmin && isAvailable && (
          <>
            <MenuOption label="Run check" icon="list-checks" onPress={onCheck} />
            <VerificationMenuOptions kind={kind} model={model} />
            <MenuDivider />
          </>
        )}
        {isAiAdmin && score !== null && (
          <>
            <MenuOption label="Reset score" icon="undo" onPress={onResetScore} />
            <MenuDivider />
          </>
        )}
        <MenuOption label="Remove" icon="trash" onPress={onRemove} danger />
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
