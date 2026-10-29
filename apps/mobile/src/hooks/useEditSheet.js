import { useNavigation } from '@react-navigation/native';
import { useRef, useState } from 'react';
import { Alert } from 'react-native';

import useDiscardGuard from '@/hooks/useDiscardGuard';
import useHaptics from '@/hooks/useHaptics';
import { requestSync } from '@/sync/worker';

/**
 * A sheet that edits one item as a draft (components/EditSheet). Returns `sheetProps` for EditSheet:
 * Add for a new item (`isNew`) or Save, on while the item `isValid` and, for Save, `isDirty`; it runs
 * `save()` once and closes the sheet, and × closes it. Leaving while `isDirty` asks first
 * (useDiscardGuard; `confirmDiscard()` asks before another action that would drop the changes).
 *
 * `finish(write, failure)` is every last write of the sheet (Add/Save, Delete, Duplicate): it runs
 * `write()`, syncs (unless the store the sheet writes to syncs by itself, `syncsItself`) and leaves
 * the sheet with what `write` resolves to (a navigate callback; `navigation.goBack()` otherwise), or
 * keeps it open when that is false (the item exists already, say). A write that throws says so with
 * `failure` as the title and keeps the sheet open. One write at a time: while one runs (`isSaving`,
 * which also turns the sheet's buttons off) another tap does nothing, and once the sheet is leaving
 * nothing more is written.
 */
export default function useEditSheet({ isNew = false, isValid = true, isDirty, save, syncsItself = false }) {
  const navigation = useNavigation();
  const haptics = useHaptics();
  const [isSaving, setIsSaving] = useState(false);
  const busyRef = useRef(false);
  const { leave, confirmDiscard } = useDiscardGuard(isDirty);

  async function finish(write, failure) {
    // A ref, not state: two taps in one frame both see the state from before the first.
    if (busyRef.current) return;
    busyRef.current = true;
    setIsSaving(true);
    let isLeaving = false;
    try {
      const navigate = await write();
      if (navigate === false) return;
      if (!syncsItself) requestSync();
      leave(typeof navigate === 'function' ? navigate : undefined);
      isLeaving = true;
    } catch (error) {
      console.error(failure, error);
      haptics.error();
      Alert.alert(failure, error.message);
    } finally {
      if (!isLeaving) {
        busyRef.current = false;
        setIsSaving(false);
      }
    }
  }

  const sheetProps = {
    confirmLabel: isNew ? 'Add' : 'Save',
    canConfirm: isValid && (isNew || isDirty),
    isSaving,
    onConfirm: () => finish(save, "Couldn't save your changes"),
    onCancel: () => navigation.goBack(),
  };

  return { sheetProps, finish, leave, confirmDiscard };
}
