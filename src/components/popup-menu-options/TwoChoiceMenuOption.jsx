import { View, Text, StyleSheet } from 'react-native';
import { MenuOption } from 'react-native-popup-menu';

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
    <View style={[popupMenuStyles.menuOption, styles.menuOption, style]}>
      <Text style={[popupMenuStyles.menuOptionText, styles.menuOptionText]}>{label}</Text>
      <View style={styles.optionsContainer}>
        <MenuOption onSelect={onPressOptionB} customStyles={{ optionWrapper: styles.optionButton }}>
          <Text style={[styles.optionButtonText, optionBSelected && styles.optionButtonTextActive]}>↓</Text>
        </MenuOption>
        <MenuOption onSelect={onPressOptionA} customStyles={{ optionWrapper: styles.optionButton }}>
          <Text style={[styles.optionButtonText, optionASelected && styles.optionButtonTextActive]}>↑</Text>
        </MenuOption>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  menuOption: {
    padding: 0,
  },
  menuOptionText: {
    paddingLeft: 12,
  },
  optionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  optionButton: {
    padding: 10,
  },
  optionButtonText: {
    fontSize: 20,
    color: 'gray',
  },
  optionButtonTextActive: {
    color: 'black',
    fontWeight: 'bold',
  },
});
