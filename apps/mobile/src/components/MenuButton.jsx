import { Children, isValidElement, useRef, useState } from 'react';
import { Menu, MenuOptions, MenuTrigger } from 'react-native-popup-menu';

import Button from '@/components/Button';
import Divider from '@/components/Divider';
import MenuOption from '@/components/popup-menu-options/MenuOption';
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
 * Rows given as MenuOptions are parted by hairlines, and a destructive one (`colorPalette="danger"`)
 * by a wider band, as iOS groups it; a menu drawn by one component (SortFilterMenu) parts its own.
 *
 * style is for layout only, on the menu's outer view (so `marginLeft: 'auto'` and flex work in a row).
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
    <Menu ref={menuRef} onOpen={() => setIsOpen(true)} onClose={() => setIsOpen(false)} style={style}>
      <MenuTrigger disabled>
        {trigger ? (
          trigger({ toggle, isOpen })
        ) : (
          <Button {...buttonProps} icon={icon} onPress={toggle} accessibilityLabel={accessibilityLabel} />
        )}
      </MenuTrigger>
      <MenuOptions customStyles={popupMenuStyles.menuOptions}>{separated(children)}</MenuOptions>
    </Menu>
  );
}

// The options with a line between each two: a hairline, or a band before a destructive one. Only
// when every child is a MenuOption.
function separated(children) {
  const options = Children.toArray(children);
  if (!options.every((child) => isValidElement(child) && child.type === MenuOption)) return children;
  return options.flatMap((option, i) =>
    i === 0
      ? [option]
      : [
          <Divider
            key={`divider-${option.key}`}
            variant={option.props.colorPalette === 'danger' ? 'menu' : 'menuRow'}
          />,
          option,
        ],
  );
}
