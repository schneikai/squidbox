import type { NewPromptButton } from '@squidbox/shared';
import type { ReactNode } from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import PromptButtonChip from './PromptButtonChip';

import useTrayInset from '@/hooks/useTrayInset';
import { raisedShadowRoom, space } from '@/styles/designTokens';

type PromptButtonRowProps = {
  buttons: readonly NewPromptButton[];
  onPress: (button: NewPromptButton) => void;
  disabled?: boolean;
  inset?: number;
  lead?: ReactNode;
  children?: ReactNode;
};

/**
 * The prompt buttons (`buttons`) as lifted chips on one line, scrolling sideways when they don't fit:
 * a tap calls `onPress(button)`; `disabled` dims them all. `lead` goes before the buttons (the post's
 * own ideas, the tray's lead chip), `children` after them (the chat's pen). The row fills its parent's width, so the chips scroll under its edges; `inset` is
 * the chips' distance from those edges: the AssistantTray's inside one, else the screen's padding.
 */
export default function PromptButtonRow({ buttons, onPress, disabled, inset, lead, children }: PromptButtonRowProps) {
  const paddingHorizontal = useTrayInset(inset);
  const padding = { paddingHorizontal };

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      style={styles.row}
      contentContainerStyle={[styles.content, padding]}
    >
      {lead}
      {buttons.map((button) => (
        <PromptButtonChip key={button.id} button={button} onPress={onPress} disabled={disabled} />
      ))}
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    marginTop: -raisedShadowRoom.top,
    marginBottom: -raisedShadowRoom.bottom,
  },
  content: {
    alignItems: 'center',
    gap: space.sm,
    paddingTop: raisedShadowRoom.top,
    paddingBottom: raisedShadowRoom.bottom,
  },
});
