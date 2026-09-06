import { View, StyleSheet } from 'react-native';

import { colors } from '@/styles/designTokens';

/**
 * Structural container for page-sheet modal screens.
 * The modal counterpart of Page: provides flex: 1 and the standard solid
 * modal background color.
 *
 * This component is intentionally dumb. It must never grow:
 *   - header logic
 *   - safe-area inset logic
 *   - padding defaults beyond flex: 1 and backgroundColor
 *   - modal-body offset behavior
 *
 * Any padding (bottom inset, horizontal, header offset, etc.) is the
 * caller's responsibility via the style prop.
 *
 * style applies to the root View.
 */
export default function ModalSheet({ children, style }) {
  return <View style={[styles.root, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.appBackground[0],
  },
});
