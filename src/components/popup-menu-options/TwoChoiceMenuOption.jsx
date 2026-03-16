import { View, Text, StyleSheet } from 'react-native';
import { MenuOption } from 'react-native-popup-menu';

import { colors, spacing, scale } from '@/styles/designTokens';
import popupMenuStyles from '@/styles/popupMenuStyles';

export default function TwoChoiceMenuOption({
  label,
  onPressOptionA,
  onPressOptionB,
  optionASelected,
  optionBSelected,
  style,
}) {
  return (
    <View style={[popupMenuStyles.menuOption, style]}>
      <Text style={[popupMenuStyles.menuOptionText, styles.label]}>{label}</Text>
      <View style={styles.controls}>
        <MenuOption onSelect={onPressOptionB} customStyles={{ optionWrapper: styles.btn }}>
          <Text style={[styles.btnText, optionBSelected && styles.btnTextActive]}>↓</Text>
        </MenuOption>
        <MenuOption onSelect={onPressOptionA} customStyles={{ optionWrapper: styles.btn }}>
          <Text style={[styles.btnText, optionASelected && styles.btnTextActive]}>↑</Text>
        </MenuOption>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    paddingLeft: spacing.menuIconSize + spacing.menuIconGap, // indent to align with icon rows
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  btn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  btnText: {
    fontSize: scale(18),
    color: colors.darkModalTextDim,
  },
  btnTextActive: {
    color: colors.accent,
    fontWeight: '700',
  },
});
