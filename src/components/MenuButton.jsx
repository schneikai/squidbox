import { useRef, useState } from 'react';
import { Menu, MenuOptions, MenuTrigger } from 'react-native-popup-menu';

import popupMenuStyles from '@/styles/popupMenuStyles';

/**
 * Generic anchored popup menu with a composable trigger.
 * Owns the toggle-safe Menu ref and open/close state.
 *
 * The trigger render prop receives { toggle, isOpen } so the trigger element
 * can reflect its active state visually without managing its own state.
 *
 * Callers inside a React Native Modal must still wrap their content in
 * <MenuProvider skipInstanceCheck>. This component does not manage that.
 *
 * Usage:
 *   <MenuButton
 *     trigger={({ toggle, isOpen }) => (
 *       <SomePressable onPress={toggle} active={isOpen} />
 *     )}
 *   >
 *     <MenuOption label="..." onPress={...} />
 *     <MenuOption label="..." onPress={...} isLast />
 *   </MenuButton>
 *
 * triggerContainerStyle — optional style for the MenuTrigger wrapper. The wrapper
 *   is intentionally unstyled by default so the trigger element fully owns its own
 *   appearance. Only provide this when you genuinely need to constrain the wrapper
 *   (e.g. to override dimensions set by the parent layout).
 *
 * menuOptionsCustomStyles — optional override for MenuOptions customStyles object
 *   passed to react-native-popup-menu (rare).
 */
export default function MenuButton({ trigger, triggerContainerStyle, menuOptionsCustomStyles, children }) {
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
      <MenuTrigger disabled customStyles={{ triggerWrapper: triggerContainerStyle }}>
        {trigger({ toggle, isOpen })}
      </MenuTrigger>
      <MenuOptions customStyles={menuOptionsCustomStyles ?? popupMenuStyles.menuOptions}>{children}</MenuOptions>
    </Menu>
  );
}
