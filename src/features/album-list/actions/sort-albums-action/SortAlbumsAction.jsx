import Ionicons from '@expo/vector-icons/Ionicons';
import { Menu, MenuOptions, MenuTrigger } from 'react-native-popup-menu';

import TwoChoiceMenuOption from '@/components/popup-menu-options/TwoChoiceMenuOption';
import headerActionStyles from '@/styles/headerActionStyles';
import popupMenuStyles from '@/styles/popupMenuStyles';

export default function SortAlbumsAction({ onPress, sortOrder }) {
  return (
    <Menu>
      <MenuTrigger customStyles={{ triggerWrapper: headerActionStyles.button }}>
        <Ionicons name="swap-vertical" style={headerActionStyles.buttonIcon} />
      </MenuTrigger>
      <MenuOptions customStyles={popupMenuStyles.menuOptions}>
        <TwoChoiceMenuOption
          label="Name"
          onPressOptionA={() => onPress('name:asc')}
          onPressOptionB={() => onPress('name:desc')}
          optionASelected={sortOrder == 'name:asc'}
          optionBSelected={sortOrder == 'name:desc'}
        />
        <TwoChoiceMenuOption
          label="Created at"
          onPressOptionA={() => onPress('createdAt:asc')}
          onPressOptionB={() => onPress('createdAt:desc')}
          optionASelected={sortOrder == 'createdAt:asc'}
          optionBSelected={sortOrder == 'createdAt:desc'}
        />
        <TwoChoiceMenuOption
          label="Last posted"
          onPressOptionA={() => onPress('lastPostedAt:asc')}
          onPressOptionB={() => onPress('lastPostedAt:desc')}
          optionASelected={sortOrder == 'lastPostedAt:asc'}
          optionBSelected={sortOrder == 'lastPostedAt:desc'}
          style={popupMenuStyles.menuOptionLast}
        />
      </MenuOptions>
    </Menu>
  );
}
