import type { ReactNode } from 'react';
import type { ViewProps } from 'react-native';

import Note from '@/components/Note';
import Text from '@/components/Text';

export type WarningNoteProps = Pick<ViewProps, 'children' | 'style'> & {
  /** Ends the note: the action that fixes it (a Button). */
  trailing?: ReactNode;
};

/**
 * A warning about what's on the screen, on a yellow note with an alert icon: something to fix that
 * doesn't stop the user (an instruction text without one of its placeholders). The parent positions
 * it through `style`.
 */
export default function WarningNote({ children, trailing, style }: WarningNoteProps) {
  return (
    <Note tone="warning" icon="alert" accessibilityRole="alert" trailing={trailing} style={style}>
      <Text size="small">{children}</Text>
    </Note>
  );
}
