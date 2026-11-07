import { CONTACT_LIMITS } from '@squidbox/shared';

import TextInput from '@/components/TextInput';
import { lineHeights, space } from '@/styles/designTokens';

// Room for three lines of a note, plus the field's padding; a longer note grows the field, as long as it is.
const MIN_HEIGHT = lineHeights.reading * 3 + space.md * 2;

/** A contact's notes as a field on its own card, three lines tall when empty and as long as the note otherwise. */
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
      isUncapped
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
