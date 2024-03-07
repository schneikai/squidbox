import Ionicons from '@expo/vector-icons/Ionicons';
import { Menu, MenuOptions, MenuTrigger } from 'react-native-popup-menu';

import FilterMenuOptions from '@/components/popup-menu-options/FilterMenuOptions';
import headerActionStyles from '@/styles/headerActionStyles';
import popupMenuStyles from '@/styles/popupMenuStyles';

export default function FilterAlbumsAction({ activeFilter, onPress }) {
  return (
    <Menu>
      <MenuTrigger
        customStyles={{
          triggerWrapper: [headerActionStyles.button, activeFilter.length && headerActionStyles.buttonWarning],
        }}
      >
        <Ionicons name="filter" style={headerActionStyles.buttonIcon} />
      </MenuTrigger>
      <MenuOptions customStyles={popupMenuStyles.menuOptions}>
        <FilterMenuOptions filters={['starred', 'archived']} onPress={onPress} activeFilter={activeFilter} />
      </MenuOptions>
    </Menu>
  );
}
