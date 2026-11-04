import { StyleSheet, View } from 'react-native';

import FloatingPill from '@/components/floating-bars/FloatingPill';
import ToolbarTitle from '@/components/floating-bars/ToolbarTitle';
import { layout, sizes } from '@/styles/designTokens';

/**
 * Unified floating header for modal screens — matches the floating-bar visual language.
 *
 * The header is absolutely positioned so list/scroll content starts from y=0 and
 * scrolls underneath it. Content should set paddingTop: MODAL_HEADER_HEIGHT so the
 * first item is not hidden behind the header.
 *
 * Layout:
 *   [ FloatingPill: leading ]   [ centerTitle ]   [ FloatingPill: trailing ]
 *
 * Both side slots are automatically wrapped in FloatingPill (frosted glass). A string title sits
 * in a ToolbarTitle pill like a pushed screen's (FloatingDetailHeader), centred between the side pills.
 *
 * Props:
 *   leading     ReactElement  — typically a close Button (icon="close")
 *   trailing    ReactElement  — e.g. icon buttons; auto-wrapped in FloatingPill
 *   title       string | ReactElement
 *   subtitle    string (optional) — a smaller grey line under a string title
 */

export const MODAL_HEADER_HEIGHT = sizes.iconButton + layout.barBottom * 2 + 8;

export default function ModalHeader({ leading, trailing, title, subtitle }) {
  const center = typeof title === 'string' ? <ToolbarTitle title={title} subtitle={subtitle} /> : (title ?? null);

  return (
    <View style={styles.container} pointerEvents="box-none">
      {/* Left slot — wrapped in FloatingPill */}
      {leading != null && (
        <View style={styles.side} pointerEvents="box-none">
          <FloatingPill>{leading}</FloatingPill>
        </View>
      )}

      {/* Center — between the side pills, an even gap to each */}
      <View style={styles.center} pointerEvents="box-none">
        {center}
      </View>

      {/* Right slot — wrapped in FloatingPill */}
      {!!trailing && (
        <View style={styles.side} pointerEvents="box-none">
          <FloatingPill>{trailing}</FloatingPill>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: layout.sideGutter,
    paddingVertical: layout.barBottom,
    zIndex: 100,
  },
  side: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: layout.barPaddingX,
  },
});
