import { View, Text } from 'react-native';
import { StyleSheet } from 'react-native';
import { MenuOption } from 'react-native-popup-menu';
import Ionicons from '@expo/vector-icons/Ionicons';
import popupMenuStyles from '@/styles/popupMenuStyles';

export default function FilterMenuOptions({ filters, onPress, activeFilter }) {
  return (
    <>
      <MenuOption onSelect={() => onPress('all')} style={popupMenuStyles.menuOption}>
        <Text style={popupMenuStyles.menuOptionText}>All</Text>
        {activeFilter.length === 0 && <Ionicons name="checkmark" style={popupMenuStyles.menuOptionIcon} />}
      </MenuOption>
      <Text style={styles.divider}>Only</Text>
      {filters.map((filter, index) => (
        <MenuOption
          onSelect={() => onPress(filter)}
          key={filter}
          style={[popupMenuStyles.menuOption, index === filters.length - 1 && popupMenuStyles.menuOptionLast]}
        >
          <Text style={popupMenuStyles.menuOptionText}>{filter.charAt(0).toUpperCase() + filter.slice(1)}</Text>
          {activeFilter.includes(filter) && <Ionicons name="checkmark" style={popupMenuStyles.menuOptionIcon} />}
        </MenuOption>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  divider: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    fontSize: 12,
    color: 'dimgray',
    backgroundColor: 'silver',
  },
});
