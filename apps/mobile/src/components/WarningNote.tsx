import type { ReactNode } from 'react';
import { StyleSheet, View, type ViewProps } from 'react-native';

import Note from '@/components/Note';
import Text from '@/components/Text';
import { space } from '@/styles/designTokens';

export type WarningNoteProps = Pick<ViewProps, 'children' | 'style'> & { action?: ReactNode };

/**
 * A warning about what's on the screen, on a yellow note with an alert icon: something to fix that
 * doesn't stop the user (an instruction text without one of its placeholders). `action` (a small
 * Button) sits under the text: how to fix it. The parent positions it through `style`.
 */
export default function WarningNote({ children, action, style }: WarningNoteProps) {
  return (
    <Note tone="warning" icon="alert" accessibilityRole="alert" style={style}>
      {action ? (
        <View style={styles.withAction}>
          <Text size="small">{children}</Text>
          <View style={styles.action}>{action}</View>
        </View>
      ) : (
        <Text size="small">{children}</Text>
      )}
    </Note>
  );
}

const styles = StyleSheet.create({
  withAction: {
    gap: space.sm,
  },
  // The button keeps its own width, at the start of the line.
  action: {
    alignItems: 'flex-start',
  },
});
