import { useNavigation } from '@react-navigation/native';
import { useRef, useState } from 'react';
import { Alert } from 'react-native';

import useDiscardGuard from '@/hooks/useDiscardGuard';
import useHaptics from '@/hooks/useHaptics';
import { requestSync } from '@/sync/worker';
import apiErrorMessage from '@/utils/cloud-api/apiErrorMessage';

/**
 * A sheet that edits one item as a draft (components/EditSheet). Returns `sheetProps` for EditSheet:
 * Add for a new item (`isNew`) or Save, on while the item `isValid` and, for Save, `isDirty`; it runs
 * `save()` once and closes the sheet, and × closes it. Leaving while `isDirty` asks first
 * (useDiscardGuard; `confirmDiscard()` asks before another action that would drop the changes).
 *
 * `finish(write, failure)` is every last write of the sheet (Add/Save, Delete, Duplicate): it runs
 * `write()`, then syncs (unless the store the sheet writes to syncs by itself, `syncsItself`) and
 * leaves the sheet. `write` resolves to `{ refused: message }` to keep the sheet open and say why
 * (the item exists already, say): `notice` is that message while the draft's `text` is still the
 * refused one. It resolves to a function to leave with it (a navigate callback), or to anything else
 * to go back. A write that throws says so with `failure` as the title and keeps the sheet open. One
 * write at a time: while one runs, or while the screen is `isBusy` with work of its own, `isSaving`
 * turns the sheet's buttons off, another tap does nothing and a swipe down keeps the sheet; once the
 * sheet is leaving nothing more is written.
 */
export default function useEditSheet({
  isNew = false,
  isValid = true,
  isDirty,
  save,
  syncsItself = false,
  isBusy = false,
  text,
}) {
  const navigation = useNavigation();
  const haptics = useHaptics();
  const [isWriting, setIsWriting] = useState(false);
  // The text a write refused and why.
  const [refused, setRefused] = useState(null);
  // A ref, not state: two taps in one frame both see the state from before the first.
  const busyRef = useRef(false);
  const isSaving = isWriting || isBusy;
  const { leave, confirmDiscard } = useDiscardGuard(isDirty, isSaving);

  function release() {
    busyRef.current = false;
    setIsWriting(false);
  }

  async function finish(write, failure) {
    if (busyRef.current) return;
    busyRef.current = true;
    setIsWriting(true);
    const writtenText = text;
    try {
      const navigate = await write();
      if (navigate?.refused) {
        setRefused({ text: writtenText, message: navigate.refused });
        release();
        return;
      }
      if (!syncsItself) requestSync();
      leave(typeof navigate === 'function' ? navigate : undefined);
    } catch (error) {
      console.error(failure, error);
      haptics.error();
      Alert.alert(failure, apiErrorMessage(error));
      release();
    }
  }

  const notice = refused && refused.text === text ? refused.message : null;
  const sheetProps = {
    confirmLabel: isNew ? 'Add' : 'Save',
    canConfirm: isValid && (isNew || isDirty),
    isSaving,
    onConfirm: () => finish(save, "Couldn't save your changes"),
    onCancel: () => navigation.goBack(),
  };

  return { sheetProps, notice, finish, confirmDiscard };
}
