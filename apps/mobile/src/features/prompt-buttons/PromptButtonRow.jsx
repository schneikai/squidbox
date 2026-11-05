import { useContext } from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import PromptButtonChip from './PromptButtonChip';

import AssistantTrayContext from '@/components/AssistantTrayContext';
import { SCREEN_PADDING } from '@/constants';
import { raisedShadowRoom } from '@/styles/designTokens';

/**
 * The prompt buttons (`buttons`) as lifted chips on one line, scrolling sideways when they don't fit:
 * a tap calls `onPress(button)`. `leading` goes before the buttons (Ask anything), `children` after
 * them (the pen). The row fills its parent's width, so the chips scroll under its edges; `inset` is
 * the chips' distance from those edges: the AssistantTray's inside one, else the screen's padding.
 */
export default function PromptButtonRow({ buttons, onPress, inset, leading, children }) {
  const tray = useContext(AssistantTrayContext);
  const padding = { paddingHorizontal: inset ?? tray?.inset ?? SCREEN_PADDING };

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      style={styles.row}
      contentContainerStyle={[styles.content, padding]}
    >
      {leading}
      {buttons.map((button) => (
        <PromptButtonChip key={button.id} button={button} variant="raised" onPress={onPress} />
      ))}
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    marginVertical: -raisedShadowRoom,
  },
  content: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: raisedShadowRoom,
  },
});
