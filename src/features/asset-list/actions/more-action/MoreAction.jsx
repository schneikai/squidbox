import Ionicons from '@expo/vector-icons/Ionicons';
import { Menu, MenuOptions, MenuTrigger } from 'react-native-popup-menu';

import ToggleThumbnailStyleOption from '@/components/popup-menu-options/ToggleThumbnailStyleOption';
import headerActionStyles from '@/styles/headerActionStyles';
import popupMenuStyles from '@/styles/popupMenuStyles';

export default function MoreAction() {
  return (
    <Menu>
      <MenuTrigger customStyles={{ triggerWrapper: headerActionStyles.button }}>
        <Ionicons name="ellipsis-vertical" style={headerActionStyles.buttonIcon} />
      </MenuTrigger>
      <MenuOptions customStyles={popupMenuStyles.menuOptions}>
        <ToggleThumbnailStyleOption />
      </MenuOptions>
    </Menu>
  );
}
