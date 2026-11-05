import { CONTACT_HANDLE_FIELDS, CONTACT_LIMITS } from '@squidbox/shared';
import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import QuickAddCard from './QuickAddCard';
import contactFromScreenshotAsync from './contactFromScreenshotAsync';
import useClipboardXLink from './useClipboardXLink';
import useNewContactDraft from './useNewContactDraft';

import Button from '@/components/Button';
import Card from '@/components/Card';
import Icon from '@/components/Icon';
import { handleText } from '@/features/contact-detail/contactFields';
import useHasFeature from '@/hooks/useHasFeature';
import { colors, lineHeights, scale, typography } from '@/styles/designTokens';
import apiErrorMessage from '@/utils/cloud-api/apiErrorMessage';

// The draft fields a screenshot's reading fills, from what it read: only what it found, within the
// contact's limits (a place joins first and the last one goes past CONTACT_LIMITS.places).
function filledFrom(read, draft) {
  const fields = {};
  for (const field of CONTACT_HANDLE_FIELDS)
    if (read[field]) fields[field] = handleText(field, read[field].slice(0, CONTACT_LIMITS.handle));
  if (read.name) fields.name = read.name.slice(0, CONTACT_LIMITS.name);
  const place = read.place?.slice(0, CONTACT_LIMITS.place);
  if (place && !draft.places.includes(place))
    fields.places = [place, ...draft.places.filter(Boolean)].slice(0, CONTACT_LIMITS.places);
  return fields;
}

/**
 * The New contact sheet's quick adds, side by side as cards: Paste X link, which fills the X handle
 * (and the name when empty) from the X profile link on the clipboard, its hint naming the link once
 * one is seen there; and with the `ai` feature Get info from screenshot, which fills what the
 * assistant read, says so in a card with Undo, and marks the fields.
 */
export default function QuickAddBar() {
  const { draft, setField, fillFields, filledFields, undoFill } = useNewContactDraft();
  const { link, readAsync } = useClipboardXLink();
  const canReadScreenshots = useHasFeature('ai');
  const [isReading, setIsReading] = useState(false);

  async function handlePaste() {
    let pasted = null;
    try {
      pasted = await readAsync();
    } catch (error) {
      console.warn('Could not read the clipboard', error);
    }
    if (!pasted) {
      Alert.alert('No X link on the clipboard', 'Copy the link of a profile on X, then tap Paste X link.');
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
        <QuickAddCard
          icon="link"
          title="Paste X link"
          hint={link ? `${link.url.replace(/^https?:\/\/(www\.)?/, '')} is on your clipboard` : 'From a profile on X'}
          onPress={handlePaste}
        />
        {canReadScreenshots && (
          <QuickAddCard
            icon="sparkle"
            title="Get info from screenshot"
            hint="The assistant reads a profile screenshot"
            isAssistant
            loading={isReading}
            onPress={handleScreenshot}
          />
        )}
      </View>
      {filledFields.length > 0 && (
        <Card style={styles.note}>
          <Icon name="sparkle" size={scale(18)} color={colors.accent.base} filled />
          <Text style={styles.noteText}>
            The assistant filled the marked fields from your screenshot. Check them before you add.
          </Text>
          <Button label="Undo" size="small" onPress={undoFill} />
        </Card>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    gap: 12,
  },
  cards: {
    flexDirection: 'row',
    gap: 10,
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
