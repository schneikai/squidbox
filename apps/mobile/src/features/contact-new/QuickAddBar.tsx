import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import QuickAddCard from './QuickAddCard';
import contactFromScreenshotAsync from './contactFromScreenshotAsync';
import filledFrom from './filledFrom';
import useFillFromLink from './useFillFromLink';
import useNewContactDraft from './useNewContactDraft';

import Button from '@/components/Button';
import Note from '@/components/Note';
import Text from '@/components/Text';
import FillMark from '@/features/contact-detail/FillMark';
import { contactDraft } from '@/features/contact-detail/contactFields';
import useHasFeature from '@/hooks/useHasFeature';
import { layout } from '@/styles/designTokens';
import apiErrorMessage from '@/utils/cloud-api/apiErrorMessage';

const NOTES = {
  assistant: 'Filled from your screenshot. Check the marked fields.',
  link: 'Filled from the X profile. Check the marked fields.',
};

/**
 * The New contact sheet's quick adds, side by side as cards: From link, which fills what the public
 * X profile on the clipboard shows (useFillFromLink); and with the `ai` feature From screenshot,
 * which fills what the assistant read. A fill says so in a note with Undo, and marks the fields: the
 * link icon for From link, the sparkle for From screenshot (FillMark).
 */
export default function QuickAddBar() {
  const { fillFields, fill, undoFill } = useNewContactDraft();
  const canReadScreenshots = useHasFeature('ai');
  const [isReading, setIsReading] = useState(false);
  const { isReading: isReadingLink, fillFromLinkAsync } = useFillFromLink(handleScreenshot);

  async function handleScreenshot() {
    setIsReading(true);
    try {
      const read = await contactFromScreenshotAsync();
      if (!read) return;
      // Whether it read anything; what it fills is worked out against the draft as it is now, edits
      // made during the read included.
      if (Object.keys(filledFrom(read, contactDraft())).length === 0)
        Alert.alert('Nothing to fill', 'The assistant found no name or handle in it.');
      else fillFields('assistant', (current) => filledFrom(read, current));
    } catch (error) {
      Alert.alert("Couldn't read the screenshot", apiErrorMessage(error));
    } finally {
      setIsReading(false);
    }
  }

  return (
    <View style={styles.bar}>
      <View style={styles.cards}>
        <QuickAddCard icon="link" title="From link" loading={isReadingLink} onPress={fillFromLinkAsync} />
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
      {fill && (
        <Note
          tone="card"
          leading={<FillMark source={fill.source} />}
          trailing={<Button label="Undo" size="small" onPress={undoFill} />}
        >
          <Text size="small">{NOTES[fill.source]}</Text>
        </Note>
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
});
