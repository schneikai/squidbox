import { StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Button from '@/components/Button';
import FadeView from '@/components/FadeView';
import { colors, layout, radii, shadows, typography } from '@/styles/designTokens';

/**
 * A dark bar above the home indicator that says what just happened ("Removed from favorites") with
 * an Undo, placed like a FloatingPrimaryAction. It fades in and out with `isVisible`; the caller
 * decides how long it shows.
 */
export default function UndoBar({ message, isVisible, onUndo }) {
  const { bottom } = useSafeAreaInsets();
  return (
    <FadeView isVisible={isVisible} style={[styles.container, { bottom: bottom + layout.barBottom }]}>
      <Text style={styles.message} numberOfLines={1}>
        {message}
      </Text>
      <Button label="Undo" isInverse onPress={onUndo} />
    </FadeView>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: layout.sideGutter,
    right: layout.sideGutter,
    zIndex: 100,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 20,
    borderRadius: radii.card,
    backgroundColor: colors.text.primary,
    ...shadows.floating,
  },
  message: {
    flex: 1,
    fontSize: typography.body,
    color: colors.text.inverse,
  },
});
