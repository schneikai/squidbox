import { DEFAULT_INSTRUCTIONS, INSTRUCTION_LIMITS } from '@squidbox/shared';
import { useRef, useState } from 'react';
import { Alert } from 'react-native';

import instructionText from './instructionText';

import TextEditSheet from '@/components/TextEditSheet';
import useConfirmDiscard from '@/hooks/useConfirmDiscard';
import useHaptics from '@/hooks/useHaptics';
import useLeaveWhenUnavailable from '@/hooks/useLeaveWhenUnavailable';
import useSeedOrClose from '@/hooks/useSeedOrClose';
import useLibrary from '@/library/useLibrary';
import { scale } from '@/styles/designTokens';
import { getDb } from '@/sync/db/client';
import { readInstructions, saveInstruction } from '@/sync/instructionsRepository';
import { requestSync } from '@/sync/worker';
import confirmAsync from '@/utils/confirmAsync';

// One kind of instructions (`{ kind }`): its text, the user's or the app's, to edit, and Reset to
// default while the user's is stored. A root modal, one per kind.
export default function InstructionModal({ route, navigation }) {
  const { kind } = route.params;
  const isAvailable = useLeaveWhenUnavailable();
  const { library } = useLibrary();
  const userId = library.owner.userId;
  const seed = useSeedOrClose(
    async (db) => ({ stored: (await readInstructions(db, userId))?.[kind] ?? null }),
    `${userId}:${kind}`,
  );
  if (!isAvailable || !seed) return null;
  return <InstructionEditor kind={kind} userId={userId} seed={seed} navigation={navigation} />;
}

function InstructionEditor({ kind, userId, seed, navigation }) {
  const haptics = useHaptics();
  // The user's stored text, null on the default; Reset sets it back to null.
  const [stored, setStored] = useState(seed.stored);
  const opened = stored ?? DEFAULT_INSTRUCTIONS[kind];
  const [text, setText] = useState(opened);
  const [isSaving, setIsSaving] = useState(false);
  // Set at once (state lands a render later), so a double tap writes once.
  const isWritingRef = useRef(false);
  const trimmed = text.trim();
  const allowLeave = useConfirmDiscard(navigation, text !== opened);

  const canSave = !!trimmed && trimmed !== opened;

  async function handleSave() {
    if (isWritingRef.current) return;
    isWritingRef.current = true;
    setIsSaving(true);
    try {
      await saveInstruction(getDb(), userId, kind, trimmed);
      requestSync();
      haptics.success();
      allowLeave();
      navigation.goBack();
    } catch (error) {
      console.error('Saving the instructions failed', error);
      haptics.error();
      Alert.alert("Couldn't save the instructions", error.message);
      isWritingRef.current = false;
      setIsSaving(false);
    }
  }

  async function handleReset() {
    if (isWritingRef.current) return;
    const isConfirmed = await confirmAsync({
      title: 'Reset to default?',
      message: "Your text is replaced by the app's.",
      action: 'Reset',
      destructive: true,
    });
    if (!isConfirmed) return;
    isWritingRef.current = true;
    try {
      await saveInstruction(getDb(), userId, kind, null);
      requestSync();
      haptics.success();
      setStored(null);
      setText(DEFAULT_INSTRUCTIONS[kind]);
    } catch (error) {
      console.error('Resetting the instructions failed', error);
      haptics.error();
      Alert.alert("Couldn't reset the instructions", error.message);
    } finally {
      isWritingRef.current = false;
    }
  }

  return (
    <TextEditSheet
      title={instructionText[kind].title}
      value={text}
      onChangeText={setText}
      placeholder="What the assistant is told"
      maxLength={INSTRUCTION_LIMITS.text}
      minHeight={scale(240)}
      description={`${instructionText[kind].description}. The reply format (how many posts, JSON) is added by the app and can't be changed.`}
      action={stored !== null ? { label: 'Reset to default', tone: 'danger', onPress: handleReset } : null}
      canSave={canSave}
      isSaving={isSaving}
      onSave={handleSave}
      onClose={() => navigation.goBack()}
    />
  );
}
