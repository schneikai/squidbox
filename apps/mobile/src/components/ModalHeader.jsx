import { StyleSheet, View } from 'react-native';

import FloatingPill from '@/components/floating-bars/FloatingPill';
import ToolbarTitle from '@/components/floating-bars/ToolbarTitle';
import useTitleMaxWidth from '@/components/floating-bars/useTitleMaxWidth';
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
 * in a ToolbarTitle pill like a pushed screen's (FloatingDetailHeader), centred on the screen and
 * kept clear of the wider side pill.
 *
 * Props:
 *   leading     ReactElement  — typically a close Button (icon="close")
 *   trailing    ReactElement  — e.g. icon buttons; auto-wrapped in FloatingPill
 *   title       string | ReactElement
 *   subtitle    string (optional) — a smaller grey line under a string title
 */

export const MODAL_HEADER_HEIGHT = sizes.iconButton + layout.barBottom * 2 + 8;

export default function ModalHeader({ leading, trailing, title, subtitle }) {
  const { maxWidth, onRowLayout, onLeftLayout, onRightLayout } = useTitleMaxWidth();

  const center =
    typeof title === 'string' ? (
      <ToolbarTitle title={title} subtitle={subtitle} style={maxWidth !== undefined && { maxWidth }} />
    ) : (
      (title ?? null)
    );

  return (
    <View style={styles.container} pointerEvents="box-none">
      <View style={styles.row} pointerEvents="box-none" onLayout={onRowLayout}>
        {/* Center — absolutely positioned so it stays centred on the screen; below the pills */}
        <View style={styles.center} pointerEvents="box-none">
          {center}
        </View>

        {leading != null && (
          <View style={styles.side} pointerEvents="box-none" onLayout={onLeftLayout}>
            <FloatingPill>{leading}</FloatingPill>
          </View>
        )}

        {!!trailing && (
          <View style={[styles.side, styles.sideRight]} pointerEvents="box-none" onLayout={onRightLayout}>
            <FloatingPill>{trailing}</FloatingPill>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: layout.sideGutter,
    paddingVertical: layout.barBottom,
    zIndex: 100,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  side: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
  },
  center: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sideRight: {
    marginLeft: 'auto',
  },
});
