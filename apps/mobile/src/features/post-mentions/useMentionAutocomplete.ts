import { useState } from 'react';
import type { TextInputSelectionChangeEvent } from 'react-native';

import insertMention from './insertMention';
import mentionAt from './mentionAt';

type Selection = TextInputSelectionChangeEvent['nativeEvent']['selection'];

/**
 * @mention autocomplete for a text field holding `text`, changed with `setText`: `mention`, the
 * @handle the cursor is in (mentionAt), null while there is none, the field hasn't reported its
 * cursor yet, or the text was last changed from elsewhere (Write with AI's Use); `pick(handle)` puts
 * `@handle` in its place and the cursor after it; `inputProps` go on the field instead of its own
 * onChangeText, so it reports its text and cursor and takes the cursor a pick sets.
 */
export default function useMentionAutocomplete(text: string, setText: (text: string) => void) {
  const [selection, setSelection] = useState<Selection | null>(null);
  // The text as the field (or a pick) last set it; another text came from elsewhere.
  const [fieldText, setFieldText] = useState(text);
  // The cursor a pick sets, held on the field until it reports one back.
  const [pickedSelection, setPickedSelection] = useState<Selection>();

  // A field may report the cursor of a text it hasn't handed over yet.
  const mention =
    selection && selection.start === selection.end && fieldText === text
      ? mentionAt(text, Math.min(selection.end, text.length))
      : null;

  function onChangeText(next: string) {
    setFieldText(next);
    setText(next);
  }

  function onSelectionChange(event: TextInputSelectionChangeEvent) {
    setSelection(event.nativeEvent.selection);
    setPickedSelection(undefined);
  }

  function pick(handle: string) {
    if (!mention) return;
    const next = insertMention(text, mention, handle);
    const cursor = { start: next.cursor, end: next.cursor };
    setFieldText(next.text);
    setText(next.text);
    setSelection(cursor);
    setPickedSelection(cursor);
  }

  return { mention, pick, inputProps: { onChangeText, selection: pickedSelection, onSelectionChange } };
}
