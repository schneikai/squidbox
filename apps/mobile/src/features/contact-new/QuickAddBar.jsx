import { CONTACT_HANDLE_FIELDS, CONTACT_LIMITS } from '@squidbox/shared';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import contactFromScreenshotAsync from './contactFromScreenshotAsync';
import useClipboardXLink from './useClipboardXLink';
import useNewContactDraft from './useNewContactDraft';

import Button from '@/components/Button';
import Icon from '@/components/Icon';
import Text from '@/components/Text';
import useHasFeature from '@/hooks/useHasFeature';
import { colors, sizes } from '@/styles/designTokens';
import apiErrorMessage from '@/utils/cloud-api/apiErrorMessage';

// The draft fields a screenshot's reading fills, from what it read: only what it found, within the
// contact's limits (a place joins first and the last one goes past CONTACT_LIMITS.places).
function filledFrom(read, draft) {
  const fields = {};
  for (const field of CONTACT_HANDLE_FIELDS)
    if (read[field]) fields[field] = read[field].slice(0, CONTACT_LIMITS.handle);
  if (read.name) fields.name = read.name.slice(0, CONTACT_LIMITS.name);
  const place = read.place?.slice(0, CONTACT_LIMITS.place);
  if (place && !draft.places.includes(place))
    fields.places = [place, ...draft.places.filter(Boolean)].slice(0, CONTACT_LIMITS.places);
  return fields;
}

/**
 * The New contact sheet's quick adds: Paste X link, while the clipboard holds an X profile link
 * (it fills the X handle, and the name when empty), and with the `ai` feature Get info from
 * screenshot, which fills what the assistant read, says so with Undo, and marks the fields.
 */
export default function QuickAddBar() {
  const { draft, setField, fillFields, filledFields, undoFill } = useNewContactDraft();
  const link = useClipboardXLink();
  const canReadScreenshots = useHasFeature('ai');
  const [isReading, setIsReading] = useState(false);

  function handlePaste() {
    setField('xHandle', link.handle);
    if (!draft.name.trim()) setField('name', link.handle);
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

  if (!link && !canReadScreenshots) return null;

  return (
    <View style={styles.bar}>
      <View style={styles.buttons}>
        {link && (
          <Button
            variant="secondary"
            icon="link"
            label={`Paste ${link.url.replace(/^https?:\/\//, '')}`}
            onPress={handlePaste}
          />
        )}
        {canReadScreenshots && (
          <Button
            variant="secondary"
            icon="sparkle"
            label="Get info from screenshot"
            onPress={handleScreenshot}
            loading={isReading}
          />
        )}
      </View>
      {filledFields.length > 0 && (
        <View style={styles.note}>
          <Icon name="sparkle" size={sizes.iconSmall} color={colors.accent.base} />
          <Text variant="hint" style={styles.noteText}>
            The assistant filled the marked fields from your screenshot. Check them before you add.
          </Text>
          <Button label="Undo" size="small" onPress={undoFill} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    gap: 8,
  },
  buttons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  note: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  noteText: {
    flex: 1,
  },
});
