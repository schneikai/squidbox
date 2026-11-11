import type { ReactNode } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import Icon from '@/components/Icon';
import IntroText from '@/components/IntroText';
import { colors, sizes, space } from '@/styles/designTokens';

type EditableLineProps = {
  label: string;
  editHint: string;
  onPress: () => void;
  // The assistant's quieter violet, on one line with no chevron (inside its tray), else grey.
  tone?: 'accentSoft';
  children: ReactNode;
};

/**
 * A grey line of the chat card ("Sees …", "Mentions …"), its `label` in bold and the `children`
 * after it, with a chevron: a tap (`onPress`) opens what edits it (`editHint`, for a screen reader).
 * `tone="accentSoft"` for the same line in the assistant's tray: violet, cut to one line, no chevron.
 */
export default function EditableLine({ label, editHint, onPress, tone, children }: EditableLineProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityHint={editHint}
      style={({ pressed }) => [styles.line, pressed && styles.pressed]}
    >
      <IntroText label={label} tone={tone} numberOfLines={tone ? 1 : undefined} style={styles.text}>
        {children}
      </IntroText>
      {!tone && <Icon name="chevron-right" size={sizes.iconSmall} color={colors.text.tertiary} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  pressed: {
    opacity: 0.6,
  },
  text: {
    flex: 1,
  },
});
