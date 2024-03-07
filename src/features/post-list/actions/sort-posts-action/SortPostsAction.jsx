import Ionicons from '@expo/vector-icons/Ionicons';
import { Menu, MenuOptions, MenuTrigger } from 'react-native-popup-menu';

import TwoChoiceMenuOption from '@/components/popup-menu-options/TwoChoiceMenuOption';
import headerActionStyles from '@/styles/headerActionStyles';
import popupMenuStyles from '@/styles/popupMenuStyles';

export default function SortPostsAction({ sortOrder, onPress }) {
  return (
    <Menu>
      <MenuTrigger customStyles={{ triggerWrapper: headerActionStyles.button }}>
        <Ionicons name="swap-vertical" style={headerActionStyles.buttonIcon} />
      </MenuTrigger>
      <MenuOptions customStyles={popupMenuStyles.menuOptions}>
        <TwoChoiceMenuOption
          label="Posted"
          onPressOptionA={() => onPress('postedAt:asc')}
          onPressOptionB={() => onPress('postedAt:desc')}
          optionASelected={sortOrder === 'postedAt:asc'}
          optionBSelected={sortOrder === 'postedAt:desc'}
          style={popupMenuStyles.menuOptionLast}
        />
      </MenuOptions>
    </Menu>
  );
}
