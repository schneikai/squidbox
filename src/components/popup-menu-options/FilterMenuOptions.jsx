import Ionicons from '@expo/vector-icons/Ionicons';
import { View, Text, StyleSheet } from 'react-native';
import { MenuOption } from 'react-native-popup-menu';

import { colors, spacing, scale } from '@/styles/designTokens';
import popupMenuStyles from '@/styles/popupMenuStyles';

export default function FilterMenuOptions({ filters, onPress, activeFilter }) {
  return (
    <>
      <MenuOption onSelect={() => onPress('all')} style={popupMenuStyles.menuOption}>
        <Text style={[popupMenuStyles.menuOptionText, styles.allLabel]}>All</Text>
        {activeFilter.length === 0 && (
          <Ionicons name="checkmark" size={spacing.menuIconSize} color={colors.accent} />
        )}
      </MenuOption>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionLabel}>Only</Text>
      </View>

      {filters.map((filter, index) => (
        <MenuOption
          onSelect={() => onPress(filter)}
          key={filter}
          style={[
            popupMenuStyles.menuOption,
            index === filters.length - 1 && popupMenuStyles.menuOptionLast,
          ]}
        >
          <Text style={[popupMenuStyles.menuOptionText, styles.filterLabel]}>
            {filter.charAt(0).toUpperCase() + filter.slice(1)}
          </Text>
          {activeFilter.includes(filter) && (
            <Ionicons name="checkmark" size={spacing.menuIconSize} color={colors.accent} />
          )}
        </MenuOption>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  allLabel: {
    paddingLeft: spacing.menuIconSize + spacing.menuIconGap,
  },
  filterLabel: {
    paddingLeft: spacing.menuIconSize + spacing.menuIconGap,
  },
  sectionHeader: {
    paddingHorizontal: spacing.menuRowH,
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.darkModalBorder,
  },
  sectionLabel: {
    fontSize: scale(11),
    fontWeight: '600',
    color: colors.darkModalTextDim,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
