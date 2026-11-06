import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import QuickAddCard from './QuickAddCard';
import contactFromScreenshotAsync from './contactFromScreenshotAsync';
import filledFrom from './filledFrom';
import useClipboardXLink from './useClipboardXLink';
import useNewContactDraft from './useNewContactDraft';

import Button from '@/components/Button';
import Card from '@/components/Card';
import Icon from '@/components/Icon';
import Text from '@/components/Text';
import { contactDraft, handleText } from '@/features/contact-detail/contactFields';
import useHasFeature from '@/hooks/useHasFeature';
import { colors, layout, sizes } from '@/styles/designTokens';
import apiErrorMessage from '@/utils/cloud-api/apiErrorMessage';
import readXProfileAsync from '@/utils/cloud-api/contacts/readXProfileAsync';

const NOTES = {
  assistant: 'Filled from your screenshot. Check the marked fields.',
  link: 'Filled from the X profile. Check the marked fields.',
};

/**
 * The New contact sheet's quick adds, side by side as cards: From link, which fills the X handle from
 * the X profile link on the clipboard at once, then what the public profile shows (the name, photo,
 * place, bio and website as the notes, and the handles it names) as the server reads it; and with
 * the `ai` feature From screenshot, which fills what the assistant read. A fill says so in a card
 * with Undo, and marks the fields: the link icon for From link, the sparkle for From screenshot.
 */
export default function QuickAddBar() {
  const { draft, setField, fillFields, fill, undoFill } = useNewContactDraft();
  const { readAsync } = useClipboardXLink();
  const canReadScreenshots = useHasFeature('ai');
  const [isReadingLink, setIsReadingLink] = useState(false);
  const [isReading, setIsReading] = useState(false);

  async function handleLink() {
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
    const { handle } = pasted;
    setField('xHandle', handleText('xHandle', handle));
    // Without more from the profile, the contact is named after the handle, unless it has a name.
    const nameAfterHandle = () => {
      if (!draft.name.trim()) setField('name', handle);
    };
    setIsReadingLink(true);
    try {
      const read = await readXProfileAsync(handle);
      if (read.status === 'found') {
        const photoUri = read.avatar ? `data:${read.avatar.mimeType};base64,${read.avatar.base64}` : undefined;
        fillFields('link', (current) => filledFrom({ ...read, name: read.name || handle }, current), photoUri);
      } else if (read.status === 'notFound') {
        nameAfterHandle();
        Alert.alert(
          `No profile @${handle} on X`,
          "The link points at a profile that doesn't exist. The handle is filled in anyway.",
        );
      } else if (read.status === 'unavailable') {
        nameAfterHandle();
        Alert.alert(
          'X hides this profile',
          'X shows this profile only to signed-in readers, so there is nothing more to fill.',
          canReadScreenshots
            ? [
                { text: 'OK', style: 'cancel' },
                { text: 'From screenshot', onPress: handleScreenshot },
              ]
            : undefined,
        );
      } else {
        // The server logged why; the handle is what From link always fills.
        console.warn('From link: the X profile could not be read');
        nameAfterHandle();
      }
    } catch (error) {
      console.warn('From link: the X profile could not be read', error);
      nameAfterHandle();
    } finally {
      setIsReadingLink(false);
    }
  }

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
        <QuickAddCard icon="link" title="From link" loading={isReadingLink} onPress={handleLink} />
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
        <Card style={styles.note}>
          {/* The same mark as on the fields it filled, so the note points at them. */}
          {fill.source === 'assistant' ? (
            <Icon name="sparkle" size={sizes.menuIcon} color={colors.accent.base} filled />
          ) : (
            <Icon name="link" size={sizes.menuIcon} color={colors.text.secondary} />
          )}
          <Text variant="reading" size="small" style={styles.noteText}>
            {NOTES[fill.source]}
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
  // A Note's row on the white card: its mark, its text and Undo.
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
