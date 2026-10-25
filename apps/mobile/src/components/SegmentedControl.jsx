import { Pressable, StyleSheet, Text, View } from 'react-native';

import useHaptics from '@/hooks/useHaptics';
import { colors, radii, shadows, typography } from '@/styles/designTokens';

/**
 * A choice of one among a few, as text segments in a grey track, the chosen one lifted white (a
 * form's option, like where a prompt button shows). `items` are `{ key, label }`. SegmentedPill is
 * the icon toolbar.
 */
export default function SegmentedControl({ items, activeKey, onSelect }) {
  const haptics = useHaptics();

  function handleSelect(key) {
    if (key === activeKey) return;
    haptics.selection();
    onSelect(key);
  }

  return (
    <View style={styles.track} accessibilityRole="radiogroup">
      {items.map(({ key, label }) => {
        const isActive = key === activeKey;
        return (
          <Pressable
            key={key}
            onPress={() => handleSelect(key)}
            accessibilityRole="radio"
            accessibilityState={{ selected: isActive }}
            style={[styles.segment, isActive && styles.active]}
          >
            <Text style={[styles.label, isActive && styles.activeLabel]} numberOfLines={1}>
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    backgroundColor: colors.background.muted,
    borderRadius: radii.pill,
    padding: 2,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: radii.pill,
  },
  active: {
    backgroundColor: colors.background.surface,
    ...shadows.subtle,
  },
  label: {
    fontSize: typography.subheadline,
    color: colors.text.secondary,
  },
  activeLabel: {
    color: colors.text.primary,
    fontWeight: '500',
  },
});
