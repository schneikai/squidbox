import { useRef, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import PROMPT_BUTTON_ICONS from './promptButtonIcons';

import Card from '@/components/Card';
import IconButton from '@/components/IconButton';
import useHaptics from '@/hooks/useHaptics';
import { colors, sizes } from '@/styles/designTokens';

const GAP = 4;
const PADDING = 8;

/**
 * The icon a prompt button leads with (`value`, an Icon name or null): None, then the icons it can
 * have, as one row of round cells that scrolls sideways, the chosen one on the accent disc and
 * scrolled into view when the sheet opens. A stored name the list doesn't have is a cell of its own,
 * so a Save keeps it.
 */
export default function IconPicker({ value, onChange }) {
  const haptics = useHaptics();
  const scrollViewRef = useRef(null);
  const hasScrolledRef = useRef(false);
  // The cell to show when the sheet opens (None is 0), centred once the row knows its width.
  const [initialIndex] = useState(() => (value === null ? 0 : cellsFor(value).indexOf(value) + 1));
  const names = cellsFor(value);

  function handleLayout(event) {
    if (hasScrolledRef.current) return;
    hasScrolledRef.current = true;
    const index = initialIndex;
    if (index <= 0) return;
    const { width } = event.nativeEvent.layout;
    const x = PADDING + index * (sizes.iconButton + GAP) - (width - sizes.iconButton) / 2;
    scrollViewRef.current?.scrollTo({ x: Math.max(0, x), animated: false });
  }

  function handlePick(name) {
    if (name === value) return;
    haptics.selection();
    onChange(name);
  }

  return (
    <Card>
      <ScrollView
        ref={scrollViewRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        onLayout={handleLayout}
        contentContainerStyle={styles.row}
        accessibilityRole="radiogroup"
      >
        <IconButton
          icon="circle-off"
          variant={value === null ? 'primary' : 'plain'}
          color={colors.text.secondary}
          accessibilityLabel="No icon"
          onPress={() => handlePick(null)}
        />
        {names.map((name) => (
          <IconButton
            key={name}
            icon={name}
            variant={name === value ? 'primary' : 'plain'}
            color={colors.accent.base}
            accessibilityLabel={name.replace(/-/g, ' ')}
            onPress={() => handlePick(name)}
          />
        ))}
      </ScrollView>
    </Card>
  );
}

// The icons to offer: the list, and a stored name it doesn't have at the end.
function cellsFor(value) {
  return value && !PROMPT_BUTTON_ICONS.includes(value) ? [...PROMPT_BUTTON_ICONS, value] : PROMPT_BUTTON_ICONS;
}

const styles = StyleSheet.create({
  row: {
    padding: PADDING,
    gap: GAP,
  },
});
