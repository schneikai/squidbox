import { useCallback, useState } from 'react';

import type { FieldSelection } from './MentionInput';
import mentionAt, { type TypedMention } from './mentionAt';

// What the mention field holds as it last reported it: its text, its selection, and whether the
// text is the user's (false once set from elsewhere, until the user changes it).
type FieldState = { text: string; selection: FieldSelection | null; isTyped: boolean };

/**
 * @mention autocomplete over a mention field's text and selection: `mention`, the @ being typed
 * (mentionAt), null while there is none or the field's text was last set from elsewhere (a saved
 * post opening, Write with AI's Use) and the user has not changed it since. The field reports
 * through `onContent` and `onSelection`; `onSetContent` notes a text set from elsewhere. The three stay
 * the same across renders.
 */
export default function useMentionAutocomplete() {
  const [field, setField] = useState<FieldState>({ text: '', selection: null, isTyped: false });
  const { text, selection, isTyped } = field;

  const mention: TypedMention | null =
    isTyped && selection && selection.start === selection.end
      ? mentionAt(text, Math.min(selection.end, text.length))
      : null;

  const onContent = useCallback(
    (next: string, nextSelection: FieldSelection) => setField({ text: next, selection: nextSelection, isTyped: true }),
    [],
  );
  // A selection the state already has (the one a text change carried) renders nothing.
  const onSelection = useCallback(
    (next: FieldSelection) =>
      setField((state) =>
        state.selection?.start === next.start && state.selection.end === next.end
          ? state
          : { ...state, selection: next },
      ),
    [],
  );
  const onSetContent = useCallback((next: string) => setField({ text: next, selection: null, isTyped: false }), []);

  return { mention, onContent, onSelection, onSetContent };
}
