import IconButton from './IconButton';
import MenuButton from './MenuButton';

/**
 * Convenience wrapper: an IconButton that opens an anchored popup menu.
 * Composes MenuButton with a default IconButton trigger.
 *
 * Callers inside a React Native Modal must still wrap their content in
 * <MenuProvider skipInstanceCheck>. This component does not manage that.
 *
 * Usage:
 *   <IconMenuButton accessibilityLabel="Post options">
 *     <MenuOption label="..." icon="..." onPress={...} />
 *     <MenuOption label="..." icon="..." onPress={...} isLast />
 *   </IconMenuButton>
 *
 * style — forwarded to MenuButton's triggerContainerStyle. The wrapper is unstyled
 *   by default; IconButton owns its own appearance. Only pass style when you need
 *   to constrain the outer wrapper (rare).
 */
export default function IconMenuButton({
  icon = 'menu',
  accessibilityLabel = 'More options',
  style,
  children,
}) {
  return (
    <MenuButton
      trigger={({ toggle }) => (
        <IconButton
          icon={icon}
          onPress={toggle}
          accessibilityLabel={accessibilityLabel}
        />
      )}
      triggerContainerStyle={style}
    >
      {children}
    </MenuButton>
  );
}
