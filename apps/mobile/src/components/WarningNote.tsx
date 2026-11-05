import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

import Note from '@/components/Note';
import Text from '@/components/Text';

type WarningNoteProps = { children: ReactNode; style?: StyleProp<ViewStyle> };

/**
 * A warning about what's on the screen, on a yellow note with an alert icon: something to fix that
 * doesn't stop the user (an instruction text without one of its placeholders). The parent positions
 * it through `style`.
 */
export default function WarningNote({ children, style }: WarningNoteProps) {
  return (
    <Note tone="warning" icon="alert" accessibilityRole="alert" style={style}>
      <Text size="small">{children}</Text>
    </Note>
  );
}
