import { Children, isValidElement, type ReactElement, type ReactNode, useCallback, useRef, useState } from 'react';
import { Menu, MenuOptions, MenuTrigger } from 'react-native-popup-menu';

import Button, { type ButtonProps } from '@/components/Button';
import Divider from '@/components/Divider';
import MenuOption, { type MenuOptionProps } from '@/components/popup-menu-options/MenuOption';
import useHaptics from '@/hooks/useHaptics';
import popupMenuStyles from '@/styles/popupMenuStyles';

export type MenuButtonProps = Omit<ButtonProps, 'onPress'> & {
  trigger?: (menu: { toggle: () => void; openFromLongPress: () => void; isOpen: boolean }) => ReactNode;
  children: ReactNode;
};

/**
 * A button that opens an anchored popup menu of `children` (MenuOption rows). Owns the toggle-safe
 * Menu ref and its open state.
 *
 * Without `trigger` it is a Button and takes Button's props: the ⋯ icon (`icon="menu"`) and "More
 * options" unless told otherwise. `trigger` draws another one instead: a render prop that receives
 * `{ toggle, openFromLongPress, isOpen }`, so it can show that its menu is open; a row that opens its
 * menu on a long press passes `openFromLongPress`, which gives the peek tap and opens it. Both stay
 * the same function across renders, so a memo row isn't redrawn for them.
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
}: MenuButtonProps) {
  const menuRef = useRef<Menu>(null);
  const [isOpen, setIsOpen] = useState(false);
  const isOpenRef = useRef(false);
  const haptics = useHaptics();

  const toggle = useCallback(() => {
    if (isOpenRef.current) menuRef.current?.close();
    else menuRef.current?.open();
  }, []);
  const openFromLongPress = useCallback(() => {
    haptics.peek();
    menuRef.current?.open();
  }, [haptics]);

  function handleOpenChange(open: boolean) {
    isOpenRef.current = open;
    setIsOpen(open);
  }

  return (
    <Menu ref={menuRef} onOpen={() => handleOpenChange(true)} onClose={() => handleOpenChange(false)} style={style}>
      <MenuTrigger disabled>
        {trigger ? (
          trigger({ toggle, openFromLongPress, isOpen })
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
function separated(children: ReactNode): ReactNode {
  const all = Children.toArray(children);
  const options = all.filter(
    (child): child is ReactElement<MenuOptionProps> => isValidElement(child) && child.type === MenuOption,
  );
  if (options.length !== all.length) return children;
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
