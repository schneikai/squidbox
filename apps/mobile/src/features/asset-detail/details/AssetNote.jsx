import { useEffect, useRef, useState } from 'react';
import { Keyboard, Pressable, StyleSheet, Text } from 'react-native';

import Textarea from '@/components/Textarea';
import useAssets from '@/features/assets-context/useAssets';
import { colors } from '@/styles/designTokens';
import textareaTextStyle from '@/styles/textareaTextStyle';

/**
 * The asset's note at the top of its details, as Apple Photos shows a caption: its text, or "Add a
 * note" without one. While `isEditable`, a tap edits it right there. The edit ends, saving it (an
 * empty note removes it), with Done, leaving the field, or anything that takes the note away: it
 * stops being editable (paged away from) or unmounts (the panel closed, the screen left).
 * `guardPress` (useDetailsPanelDrag's) keeps a touch that dragged the panel from starting an edit;
 * `onEditingBottomChange(bottom)` follows where the field ends while it is edited (0 once done), so
 * the panel can keep it above the keyboard.
 */
export default function AssetNote({ asset, isEditable, guardPress, onEditingBottomChange }) {
  const { updateAsset } = useAssets();
  // The text being edited, `null` while not editing.
  const [draft, setDraft] = useState(null);
  // The edit under way, for ending it outside a render too (on unmount): what to save and where.
  const editing = useRef(null);
  const latest = useRef(null);
  latest.current = { updateAsset, onEditingBottomChange };

  // Ends the edit at most once, however it ends.
  function finishEditing() {
    const edit = editing.current;
    if (!edit) return;
    editing.current = null;
    latest.current.onEditingBottomChange(0);
    const notes = edit.draft.trim() || null;
    if (notes !== edit.original) latest.current.updateAsset(edit.assetId, { notes });
  }

  function handleEdit() {
    editing.current = { assetId: asset.id, original: asset.notes?.trim() || null, draft: asset.notes ?? '' };
    setDraft(editing.current.draft);
  }

  function handleChangeText(text) {
    if (editing.current) editing.current.draft = text;
    setDraft(text);
  }

  function handleEnd() {
    finishEditing();
    setDraft(null);
  }

  function handleLayout(event) {
    const { y, height } = event.nativeEvent.layout;
    if (editing.current) onEditingBottomChange(y + height);
  }

  useEffect(() => {
    if (isEditable || !editing.current) return;
    handleEnd();
    Keyboard.dismiss();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ends an edit once the note stops being editable
  }, [isEditable]);

  // eslint-disable-next-line react-hooks/exhaustive-deps -- refs only: saves the edit left open
  useEffect(() => finishEditing, []);

  if (draft !== null) {
    return (
      <Textarea
        value={draft}
        onChangeText={handleChangeText}
        onBlur={handleEnd}
        onLayout={handleLayout}
        placeholder="Add a note"
        autoFocus
        returnKeyType="done"
        submitBehavior="blurAndSubmit"
        style={styles.input}
      />
    );
  }

  return (
    <Pressable onPress={isEditable ? guardPress(handleEdit) : undefined} accessibilityRole="button">
      <Text style={[textareaTextStyle, !asset.notes && styles.placeholder]}>{asset.notes || 'Add a note'}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // As Textarea's placeholder, so it doesn't change shade when the editing starts.
  placeholder: {
    color: colors.textTertiary,
  },
  input: {
    padding: 0,
  },
});
