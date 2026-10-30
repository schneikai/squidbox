import MenuButton from './MenuButton';

import Button from '@/components/Button';

/**
 * Convenience wrapper: a Button that opens an anchored popup menu.
 * Composes MenuButton with a default Button trigger.
 *
 * Callers inside a React Native Modal must still wrap their content in
 * <MenuProvider skipInstanceCheck>. This component does not manage that.
 *
 * Usage:
 *   <IconMenuButton accessibilityLabel="Post options">
 *     <MenuOption label="..." icon="..." onPress={...} />
 *     <MenuOption label="..." icon="..." onPress={...} />
 *   </IconMenuButton>
 *
 * Other props (colorPalette, isSelected, size) go to the Button.
 *
 * style — forwarded to MenuButton's triggerContainerStyle. The wrapper is unstyled
 *   by default; Button owns its own appearance. Only pass style when you need
 *   to constrain the outer wrapper (rare).
 */
export default function IconMenuButton({
  icon = 'menu',
  accessibilityLabel = 'More options',
  style,
  children,
  ...buttonProps
}) {
  return (
    <MenuButton
      trigger={({ toggle }) => (
        <Button {...buttonProps} icon={icon} onPress={toggle} accessibilityLabel={accessibilityLabel} />
      )}
      triggerContainerStyle={style}
    >
      {children}
    </MenuButton>
  );
}
