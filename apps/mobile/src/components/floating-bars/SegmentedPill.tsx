import { Pressable, StyleSheet, Text, View } from 'react-native';

import FloatingPill from './FloatingPill';

import Button from '@/components/Button';
import type { IconName } from '@/components/Icon';
import { colors, press, radii, shadows, space, textStyles } from '@/styles/designTokens';

// `icon` makes an icon segment; without one the segment is its `label`.
export type SegmentedPillItem<Key extends string = string> = { key: Key; icon?: IconName; label: string };

export type SegmentedPillProps<Key extends string> = {
  items: SegmentedPillItem<Key>[];
  activeKey: Key;
  onSelect: (key: Key) => void;
};

/**
 * A toolbar of segments, one of them active: the tab bar and a screen's view switcher.
 * `items` are `{ key, icon, label }`; an icon segment's active one is the purple button. An item
 * without an `icon` is a text segment that shows its `label`: the active one a white thumb raised off
 * the glass, in dark text, the others grey. The pill is a tablist.
 */
export default function SegmentedPill<Key extends string>({ items, activeKey, onSelect }: SegmentedPillProps<Key>) {
  return (
    <View accessibilityRole="tablist">
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
    </View>
  );
}

type TextSegmentProps = { label: string; isActive: boolean; onPress: () => void };

function TextSegment({ label, isActive, onPress }: TextSegmentProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: isActive }}
      style={({ pressed }) => [styles.segment, isActive && styles.active, pressed && !isActive && press.flat]}
    >
      <Text style={[styles.label, isActive && styles.activeLabel]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  segment: {
    paddingVertical: space.sm,
    paddingHorizontal: space.lg,
    borderRadius: radii.pill,
  },
  active: {
    backgroundColor: colors.background.surface,
    ...shadows.thumb,
  },
  // One weight on and off, so a segment keeps its width when it's picked; only the color changes.
  label: {
    ...textStyles.subheadlineBold,
    color: colors.text.secondary,
  },
  activeLabel: {
    color: colors.text.primary,
  },
});
