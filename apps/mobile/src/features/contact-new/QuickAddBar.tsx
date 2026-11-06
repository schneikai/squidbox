import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import QuickAddCard from './QuickAddCard';
import contactFromScreenshotAsync from './contactFromScreenshotAsync';
import filledFromScreenshot from './filledFromScreenshot';
import useClipboardXLink from './useClipboardXLink';
import useNewContactDraft from './useNewContactDraft';

import Button from '@/components/Button';
import Card from '@/components/Card';
import Icon from '@/components/Icon';
import Text from '@/components/Text';
import { contactDraft, handleText } from '@/features/contact-detail/contactFields';
import useHasFeature from '@/hooks/useHasFeature';
import { colors, layout, scale } from '@/styles/designTokens';
import apiErrorMessage from '@/utils/cloud-api/apiErrorMessage';

/**
 * The New contact sheet's quick adds, side by side as cards: From link, which fills the X handle
 * (and the name when empty) from the X profile link on the clipboard; and with the `ai` feature From
 * screenshot, which fills what the assistant read, says so in a card with Undo, and marks the fields.
 */
export default function QuickAddBar() {
  const { draft, setField, fillFields, filledFields, undoFill } = useNewContactDraft();
  const { readAsync } = useClipboardXLink();
  const canReadScreenshots = useHasFeature('ai');
  const [isReading, setIsReading] = useState(false);

  async function handlePaste() {
    let pasted: Awaited<ReturnType<typeof readAsync>> = null;
    try {
      pasted = await readAsync();
    } catch (error) {
      console.warn('Could not read the clipboard', error);
    }
    if (!pasted) {
      Alert.alert('No X link on the clipboard', 'Copy the link of a profile on X, then tap From link.');
      return;
    }
    setField('xHandle', handleText('xHandle', pasted.handle));
    if (!draft.name.trim()) setField('name', pasted.handle);
  }

  async function handleScreenshot() {
    setIsReading(true);
    try {
      const read = await contactFromScreenshotAsync();
      if (!read) return;
      // Whether it read anything; what it fills is worked out against the draft as it is now, edits
      // made during the read included.
      if (Object.keys(filledFromScreenshot(read, contactDraft())).length === 0)
        Alert.alert('Nothing to fill', 'The assistant found no name or handle in it.');
      else fillFields((current) => filledFromScreenshot(read, current));
    } catch (error) {
      Alert.alert("Couldn't read the screenshot", apiErrorMessage(error));
    } finally {
      setIsReading(false);
    }
  }

  return (
    <View style={styles.bar}>
      <View style={styles.cards}>
        <QuickAddCard icon="link" title="From link" onPress={handlePaste} />
        {canReadScreenshots && (
          <QuickAddCard
            icon="sparkle"
            title="From screenshot"
            isAssistant
            loading={isReading}
            onPress={handleScreenshot}
          />
        )}
      </View>
      {filledFields.length > 0 && (
        <Card style={styles.note}>
          {/* The same sparkle as on the fields it filled, so the note points at them. */}
          <Icon name="sparkle" size={scale(16)} color={colors.accent.base} filled />
          <Text size="small" style={styles.noteText}>
            Filled from your screenshot. Check the marked fields.
          </Text>
          <Button label="Undo" size="small" onPress={undoFill} />
        </Card>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // The sheet's own gap between its parts, so the cards, the note and the cards under it sit evenly.
  bar: {
    gap: layout.cardGap,
  },
  cards: {
    flexDirection: 'row',
    gap: layout.cardGap,
  },
  // A Note's row on the white card: its sparkle, its text and Undo.
  note: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: layout.rowLeadingGap,
    paddingVertical: layout.rowPaddingYCompact,
    paddingHorizontal: layout.cardInset,
  },
  noteText: {
    flex: 1,
  },
});
