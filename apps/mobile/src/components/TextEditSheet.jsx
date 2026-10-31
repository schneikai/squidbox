import { StyleSheet } from 'react-native';

import EditSheet from '@/components/EditSheet';
import IntroText from '@/components/IntroText';
import TextInput from '@/components/TextInput';
import WarningNote from '@/components/WarningNote';

/**
 * An EditSheet that edits one text, the look of a Notes page: an optional `description` over a
 * multiline TextInput (`value`, `onChangeText`, `placeholder`, `maxLength`, `autoFocus`) that fills
 * the sheet above the keyboard and scrolls its text inside, an optional `note` over it (a
 * WarningNote about the text), and the sheet's `actions` under that. The
 * other props go to EditSheet (`title`, the props useEditSheet gives, `actions`).
 */
export default function TextEditSheet({
  value,
  onChangeText,
  placeholder,
  maxLength,
  autoFocus = false,
  description,
  note,
  ...sheetProps
}) {
  return (
    <EditSheet {...sheetProps} isFilling>
      {description != null && <IntroText isScreenIntro>{description}</IntroText>}
      {note != null && <WarningNote style={styles.note}>{note}</WarningNote>}
      <TextInput
        variant="field"
        multiline
        isFilling
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        maxLength={maxLength}
        autoFocus={autoFocus}
      />
    </EditSheet>
  );
}

const styles = StyleSheet.create({
  note: {
    marginBottom: 12,
  },
});
