import { Pressable, StyleSheet, Text } from 'react-native';

import FloatingPill from './FloatingPill';

import Button from '@/components/Button';
import { colors, press, radii, shadows, typography } from '@/styles/designTokens';

/**
 * A toolbar of segments, one of them active: the tab bar and a screen's view switcher.
 * `items` are `{ key, icon, label }`; an icon segment's active one is the purple button. An item
 * without an `icon` is a text segment that shows its `label`: the active one a white thumb raised off
 * the glass, in dark text, the others grey.
 */
export default function SegmentedPill({ items, activeKey, onSelect }) {
  return (
    <FloatingPill>
      {items.map(({ key, icon, label }) =>
        !icon ? (
          <TextSegment key={key} label={label} isActive={key === activeKey} onPress={() => onSelect(key)} />
        ) : key === activeKey ? (
          <Button
            variant="primary"
            icon={icon}
            isSelected
            key={key}
            onPress={() => onSelect(key)}
            accessibilityLabel={label}
          />
        ) : (
          <Button key={key} icon={icon} onPress={() => onSelect(key)} accessibilityLabel={label} />
        ),
      )}
    </FloatingPill>
  );
}

function TextSegment({ label, isActive, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: isActive }}
      style={({ pressed }) => [styles.segment, isActive && styles.active, pressed && !isActive && press.flat]}
    >
      <Text style={[styles.label, isActive && styles.activeLabel]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  segment: {
    paddingVertical: 9,
    paddingHorizontal: 18,
    borderRadius: radii.pill,
  },
  active: {
    backgroundColor: colors.background.surface,
    ...shadows.thumb,
  },
  // One weight on and off, so a segment keeps its width when it's picked; only the color changes.
  label: {
    fontSize: typography.subheadline,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  activeLabel: {
    color: colors.text.primary,
  },
});
