import { useRef, useState } from 'react';
import { Menu, MenuOptions, MenuTrigger } from 'react-native-popup-menu';

import Button from '@/components/Button';
import popupMenuStyles from '@/styles/popupMenuStyles';

/**
 * A button that opens an anchored popup menu of `children` (MenuOption rows). Owns the toggle-safe
 * Menu ref and its open state.
 *
 * Without `trigger` it is a Button and takes Button's props: the ⋯ icon (`icon="menu"`) and "More
 * options" unless told otherwise. `trigger` draws another one instead: a render prop that receives
 * `{ toggle, isOpen }`, so it can show that its menu is open.
 *
 * Callers inside a React Native Modal must still wrap their content in
 * <MenuProvider skipInstanceCheck>. This component does not manage that.
 *
 *   <MenuButton accessibilityLabel="Post options">
 *     <MenuOption label="..." icon="..." onPress={...} />
 *   </MenuButton>
 *
 * style is for layout only, on the trigger's wrapper.
 */
export default function MenuButton({
  trigger,
  icon = 'menu',
  accessibilityLabel = 'More options',
  style,
  children,
  ...buttonProps
}) {
  const menuRef = useRef(null);
  const [isOpen, setIsOpen] = useState(false);

  function toggle() {
    if (isOpen) {
      menuRef.current?.close();
    } else {
      menuRef.current?.open();
    }
  }

  return (
    <Menu ref={menuRef} onOpen={() => setIsOpen(true)} onClose={() => setIsOpen(false)}>
      <MenuTrigger disabled customStyles={{ triggerWrapper: style }}>
        {trigger ? (
          trigger({ toggle, isOpen })
        ) : (
          <Button {...buttonProps} icon={icon} onPress={toggle} accessibilityLabel={accessibilityLabel} />
        )}
      </MenuTrigger>
      <MenuOptions customStyles={popupMenuStyles.menuOptions}>{children}</MenuOptions>
    </Menu>
  );
}
