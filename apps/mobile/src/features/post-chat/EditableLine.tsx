import type { ReactNode } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import Icon from '@/components/Icon';
import IntroText from '@/components/IntroText';
import { colors, sizes, space } from '@/styles/designTokens';

type EditableLineProps = { label: string; editHint: string; onPress: () => void; children: ReactNode };

/**
 * A grey line of the chat card ("Sees …", "Mentions …"), its `label` in bold and the `children`
 * after it, with a chevron: a tap (`onPress`) opens what edits it (`editHint`, for a screen reader).
 */
export default function EditableLine({ label, editHint, onPress, children }: EditableLineProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityHint={editHint}
      style={({ pressed }) => [styles.line, pressed && styles.pressed]}
    >
      <IntroText label={label} style={styles.text}>
        {children}
      </IntroText>
      <Icon name="chevron-right" size={sizes.iconSmall} color={colors.text.tertiary} />
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
