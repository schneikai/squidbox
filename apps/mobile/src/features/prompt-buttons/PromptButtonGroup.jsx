import { StyleSheet, View } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated, { LinearTransition } from 'react-native-reanimated';

import PromptButtonChip from './PromptButtonChip';
import useChipReorder from './useChipReorder';

import Chip from '@/components/Chip';
import { Section } from '@/components/settings-list/SettingsList';
import { motion, radii, shadows } from '@/styles/designTokens';

// The others make room for a dragged chip, and close the gap of a deleted one, in the move motion.
const reflow = LinearTransition.duration(motion.move.duration).easing(motion.move.easing);

/**
 * The prompt buttons as chips in their order, with Add at the end: a tap opens the button
 * (`onOpen(button)`), a hold drags it to another place (`onMove(id, afterId)`), Add adds one
 * (`onAdd()`).
 */
export default function PromptButtonGroup({ buttons, onOpen, onAdd, onMove }) {
  const ids = buttons.map((button) => button.id);
  const reorder = useChipReorder({ ids, onMove });

  const byId = new Map(buttons.map((button) => [button.id, button]));
  const ordered = reorder.order.map((id) => byId.get(id)).filter(Boolean);
  const lifted = reorder.liftedId && byId.get(reorder.liftedId);

  function handleOpen(button) {
    if (reorder.isPressSuppressed()) return;
    onOpen(button);
  }

  function chip(button) {
    return (
      <PromptButtonChip
        button={button}
        onPress={handleOpen}
        accessibilityHint="Opens it to edit. Touch and hold to move it."
      />
    );
  }

  return (
    <Section>
      <GestureDetector gesture={reorder.gesture}>
        <View style={styles.chips}>
          {ordered.map((button) => (
            <Animated.View
              key={button.id}
              layout={reflow}
              onLayout={reorder.chipLayout(button.id)}
              style={button.id === reorder.liftedId && styles.gap}
            >
              {chip(button)}
            </Animated.View>
          ))}
          <Animated.View layout={reflow}>
            <Chip label="Add" variant="add" onPress={onAdd} accessibilityLabel="Add a prompt button" />
          </Animated.View>
          {lifted && (
            <Animated.View pointerEvents="none" style={[styles.lifted, shadows.lifted, reorder.liftedStyle]}>
              {chip(lifted)}
            </Animated.View>
          )}
        </View>
      </GestureDetector>
    </Section>
  );
}

const styles = StyleSheet.create({
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    padding: 16,
  },
  gap: {
    opacity: 0,
  },
  lifted: {
    zIndex: 10,
    borderRadius: radii.pill,
  },
});
