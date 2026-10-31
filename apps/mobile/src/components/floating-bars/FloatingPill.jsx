import { BlurView } from 'expo-blur';
import { StyleSheet, View } from 'react-native';

import ToolbarContext from './ToolbarContext';

import { glass, layout, radii, shadows } from '@/styles/designTokens';

/**
 * A toolbar: the frosted-glass pill that groups the buttons that belong together, one button tall
 * with a thin frame around them. Wraps content in a BlurView + border + shadow. Its tertiary icon
 * buttons each take a 44 pt slot (ToolbarContext), so their icons sit apart like discs.
 */
export default function FloatingPill({ children, style }) {
  return (
    <View style={[styles.shadow, style]}>
      <BlurView intensity={80} tint="light" style={styles.blur}>
        <View style={styles.surface}>
          <ToolbarContext.Provider value>{children}</ToolbarContext.Provider>
        </View>
      </BlurView>
    </View>
  );
}

const styles = StyleSheet.create({
  shadow: {
    borderRadius: radii.pill,
    ...shadows.floating,
    flexShrink: 1,
  },
  blur: {
    borderRadius: radii.pill,
    overflow: 'hidden',
  },
  surface: {
    ...glass,
    borderRadius: radii.pill,
    flexDirection: 'row',
    alignItems: 'center',
    padding: layout.toolbarFrame,
    flexShrink: 1,
  },
});
