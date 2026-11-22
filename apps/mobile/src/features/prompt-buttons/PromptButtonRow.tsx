import type { NewPromptButton } from '@squidbox/shared';
import type { ReactNode } from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import PromptButtonChip from './PromptButtonChip';

import useTrayInset from '@/hooks/useTrayInset';
import { space } from '@/styles/designTokens';

type PromptButtonRowProps = {
  buttons: readonly NewPromptButton[];
  onPress: (button: NewPromptButton) => void;
  disabled?: boolean;
  inset?: number;
  endInset?: number;
  lead?: ReactNode;
};

/**
 * The prompt buttons (`buttons`) as chips on one line, scrolling sideways when they don't fit:
 * a tap calls `onPress(button)`; `disabled` dims them all. `lead` goes before the buttons (the post's
 * own ideas). The row fills its parent's width, so the chips scroll under its edges; `inset` is the chips' distance from those edges: the AssistantTray's inside one, else the screen's padding; `endInset`, when
 * given, at the end instead (room for a fade there, so a row that fits ends clear of it).
 */
export default function PromptButtonRow({ buttons, onPress, disabled, inset, endInset, lead }: PromptButtonRowProps) {
  const paddingHorizontal = useTrayInset(inset);
  const padding = { paddingLeft: paddingHorizontal, paddingRight: endInset ?? paddingHorizontal };

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={[styles.content, padding]}
    >
      {lead}
      {buttons.map((button) => (
        <PromptButtonChip key={button.id} button={button} onPress={onPress} disabled={disabled} />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    alignItems: 'center',
    gap: space.sm,
  },
});
