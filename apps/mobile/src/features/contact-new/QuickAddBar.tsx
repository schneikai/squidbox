import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import type { NewContactDraftValue } from './NewContactDraftContext';
import QuickAddCard from './QuickAddCard';
import contactFromScreenshotAsync from './contactFromScreenshotAsync';
import filledFrom from './filledFrom';
import useFillFromLink from './useFillFromLink';
import useNewContactDraft from './useNewContactDraft';

import Button from '@/components/Button';
import Note from '@/components/Note';
import Text from '@/components/Text';
import FillMark from '@/features/contact-detail/FillMark';
import { type ContactDraft, HANDLE_FIELDS, contactDraft } from '@/features/contact-detail/contactFields';
import useHasFeature from '@/hooks/useHasFeature';
import { layout } from '@/styles/designTokens';
import apiErrorMessage from '@/utils/cloud-api/apiErrorMessage';

// What a fill's note says: what it was filled from, and to check the marked fields when it marked any
// (the name, the handles and the place carry marks; the photo and notes don't).
const MARKED_FIELDS = new Set<keyof ContactDraft>(['name', 'places', ...HANDLE_FIELDS.map(({ field }) => field)]);
function noteText(fill: NonNullable<NewContactDraftValue['fill']>): string {
  const from = fill.source === 'assistant' ? 'Filled from the screenshot.' : 'Filled from the link.';
  return fill.fields.some((field) => MARKED_FIELDS.has(field)) ? `${from} Check the marked fields.` : from;
}

/**
 * The New contact sheet's quick adds, both the assistant's (the `ai` feature; nothing without it), side
 * by side as cards: From link, which fills what the X profile on the clipboard shows and the assistant
 * reads from it (useFillFromLink); and From screenshot, which fills what the assistant read in a
 * picture (the image icon on its card). A fill says so in a note with
 * Undo and marks the fields it filled, both with the sparkle (FillMark).
 */
export default function QuickAddBar() {
  const { fillFields, fill, undoFill } = useNewContactDraft();
  const hasAssistant = useHasFeature('ai');
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

  if (!hasAssistant) return null;

  return (
    <View style={styles.bar}>
      <View style={styles.cards}>
        <QuickAddCard icon="link" title="From link" loading={isReadingLink} onPress={fillFromLinkAsync} />
        <QuickAddCard icon="image" title="From screenshot" loading={isReading} onPress={handleScreenshot} />
      </View>
      {fill && (fill.fields.length > 0 || fill.photoUri) && (
        <Note tone="card" leading={<FillMark />} trailing={<Button label="Undo" size="small" onPress={undoFill} />}>
          <Text size="small">{noteText(fill)}</Text>
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
