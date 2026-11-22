import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet } from 'react-native';

type EdgeFadeProps = {
  // The surface's color, and the same color see-through (a `…Clear` token), since a gradient to `transparent` greys on iOS.
  color: string;
  clearColor: string;
  width: number;
};

const START = { x: 0, y: 0 };
const END = { x: 1, y: 0 };

/**
 * A row's right edge fading into the surface it scrolls on (`color`), `width` wide, so its content
 * scrolls out under a fade instead of against a hard edge. Its parent is the row's box; it takes no
 * touches.
 */
export default function EdgeFade({ color, clearColor, width }: EdgeFadeProps) {
  return (
    <LinearGradient
      colors={[clearColor, color]}
      start={START}
      end={END}
      style={[styles.fade, { width }]}
      pointerEvents="none"
    />
  );
}

const styles = StyleSheet.create({
  fade: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
  },
});
