import { CONTACT_LIMITS } from '@squidbox/shared';

import TextInput from '@/components/TextInput';
import { lineHeights } from '@/styles/designTokens';

// Room for three lines of a note, plus the field's padding; a longer note grows the field.
const MIN_HEIGHT = lineHeights.reading * 3 + 24;

/** A contact's notes as a field on its own card, three lines tall when empty. */
type NotesFieldProps = {
  value: string;
  onChangeText: (text: string) => void;
  onBlur?: () => void;
};

export default function NotesField({ value, onChangeText, onBlur }: NotesFieldProps) {
  return (
    <TextInput
      variant="field"
      multiline
      minHeight={MIN_HEIGHT}
      value={value}
      onChangeText={onChangeText}
      onBlur={onBlur}
      placeholder="Add a note…"
      accessibilityLabel="Notes"
      maxLength={CONTACT_LIMITS.notes}
    />
  );
}
