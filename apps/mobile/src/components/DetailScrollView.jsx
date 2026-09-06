import { ScrollView, StyleSheet } from 'react-native';

import { SCREEN_PADDING } from '@/constants';
import useScreenPadding from '@/hooks/useScreenPadding';

/**
 * Scrollable body for Page-based detail screens (stack screens using
 * FloatingDetailHeader). Owns the useScreenPadding('detail') call,
 * applies paddingHorizontal: SCREEN_PADDING and correct top/bottom insets
 * to the content container, and enables automaticallyAdjustKeyboardInsets.
 *
 * Style boundaries:
 *   style               → outer ScrollView (scroll container itself; rare)
 *   contentContainerStyle → inner content container (merged after defaults)
 *
 * All other ScrollView props are forwarded via ...rest.
 */
export default function DetailScrollView({ children, style, contentContainerStyle, ...rest }) {
  const { paddingTop, paddingBottom } = useScreenPadding('detail');

  return (
    <ScrollView
      style={style}
      contentContainerStyle={[styles.content, { paddingTop, paddingBottom }, contentContainerStyle]}
      automaticallyAdjustKeyboardInsets
      {...rest}
    >
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: SCREEN_PADDING,
  },
});
