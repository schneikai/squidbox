import { StyleSheet } from 'react-native';
import Animated, { type AnimatedScrollViewProps } from 'react-native-reanimated';

import { SCREEN_PADDING } from '@/constants';
import useScreenPadding from '@/hooks/useScreenPadding';

export type DetailScrollViewProps = AnimatedScrollViewProps;

/**
 * Scrollable body for Page-based detail screens (stack screens using
 * FloatingDetailHeader). Owns the useScreenPadding('detail') call,
 * applies paddingHorizontal: SCREEN_PADDING and correct top/bottom insets
 * to the content container, and enables automaticallyAdjustKeyboardInsets. An Animated.ScrollView, so
 * useScrollY's onScroll can drive the header's title (FloatingDetailHeader's titleReveal).
 *
 * Style boundaries:
 *   style               → outer ScrollView (scroll container itself; rare)
 *   contentContainerStyle → inner content container (merged after defaults)
 *
 * All other ScrollView props are forwarded via ...rest.
 */
export default function DetailScrollView({ children, style, contentContainerStyle, ...rest }: DetailScrollViewProps) {
  const { paddingTop, paddingBottom } = useScreenPadding('detail');

  return (
    <Animated.ScrollView
      style={style}
      contentContainerStyle={[styles.content, { paddingTop, paddingBottom }, contentContainerStyle]}
      automaticallyAdjustKeyboardInsets
      {...rest}
    >
      {children}
    </Animated.ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: SCREEN_PADDING,
  },
});
