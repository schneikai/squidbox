import {
  CONTACT_HANDLE_FIELDS,
  CONTACT_LIMITS,
  type ContactFromScreenshotResponse,
  type ContactPlace,
} from '@squidbox/shared';
import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import QuickAddCard from './QuickAddCard';
import contactFromScreenshotAsync from './contactFromScreenshotAsync';
import useClipboardXLink from './useClipboardXLink';
import useNewContactDraft from './useNewContactDraft';

import Button from '@/components/Button';
import Card from '@/components/Card';
import { type ContactDraft, handleText, storedPlace } from '@/features/contact-detail/contactFields';
import useHasFeature from '@/hooks/useHasFeature';
import { colors, lineHeights, typography } from '@/styles/designTokens';
import apiErrorMessage from '@/utils/cloud-api/apiErrorMessage';

// The draft fields a screenshot's reading fills, from what it read: only what it found, within the
// contact's limits (a place it read joins first, unless the draft has it, and the last one goes past
// CONTACT_LIMITS.places).
function filledFrom(read: ContactFromScreenshotResponse, draft: ContactDraft): Partial<ContactDraft> {
  const fields: Partial<ContactDraft> = {};
  for (const field of CONTACT_HANDLE_FIELDS)
    if (read[field]) fields[field] = handleText(field, read[field].slice(0, CONTACT_LIMITS.handle));
  if (read.name) fields.name = read.name.slice(0, CONTACT_LIMITS.name);
  const part = (text: string | undefined) => (text ?? '').slice(0, CONTACT_LIMITS.place);
  const place = storedPlace({ city: part(read.city), state: part(read.state), country: part(read.country) });
  const draftPlaces = draft.places.filter((known): known is ContactPlace => storedPlace(known) !== null);
  const isKnown = draftPlaces.some((known) => JSON.stringify(storedPlace(known)) === JSON.stringify(place));
  if (place && !isKnown) fields.places = [place, ...draftPlaces].slice(0, CONTACT_LIMITS.places);
  return fields;
}

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
      const fields = filledFrom(read, draft);
      if (Object.keys(fields).length === 0)
        Alert.alert('Nothing to fill', 'The assistant found no name or handle in it.');
      else fillFields(fields);
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
          <Text style={styles.noteText}>Filled from your screenshot. Check the marked fields.</Text>
          <Button label="Undo" size="small" onPress={undoFill} />
        </Card>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // The sheet's own gap between its parts, so the cards, the note and the cards under it sit evenly.
  bar: {
    gap: 12,
  },
  cards: {
    flexDirection: 'row',
    gap: 12,
  },
  note: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  noteText: {
    flex: 1,
    fontSize: typography.detail,
    lineHeight: lineHeights.subheadline,
    color: colors.text.primary,
  },
});
