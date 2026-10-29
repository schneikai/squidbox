import { DEFAULT_INSTRUCTIONS, INSTRUCTION_LIMITS } from '@squidbox/shared';
import { useState } from 'react';

import instructionText from './instructionText';

import TextEditScreen from '@/components/TextEditScreen';
import useHaptics from '@/hooks/useHaptics';
import useLeaveWhenUnavailable from '@/hooks/useLeaveWhenUnavailable';
import useSaveAsYouType from '@/hooks/useSaveAsYouType';
import useSeedOrClose from '@/hooks/useSeedOrClose';
import useLibrary from '@/library/useLibrary';
import { getDb } from '@/sync/db/client';
import { readInstructions, saveInstruction } from '@/sync/instructionsRepository';
import confirmAsync from '@/utils/confirmAsync';

// One kind of instructions (`{ kind }`): its text, the user's or the app's, saved as you type, and
// Reset to default while the user's is stored. A root screen, one per kind.
export default function InstructionScreen({ route, navigation }) {
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
  const [text, setText] = useState(seed.stored ?? DEFAULT_INSTRUCTIONS[kind]);
  const { flush } = useSaveAsYouType(text.trim(), saveText);

  const isChanged = text.trim() !== DEFAULT_INSTRUCTIONS[kind];

  // An empty text isn't saved (Reset is the way back to the default); the default's text is stored
  // as null.
  async function saveText(next) {
    if (!next) return false;
    await saveInstruction(getDb(), userId, kind, next);
    return true;
  }

  // The default's text, saved as you type like any other (as null).
  async function handleReset() {
    const isConfirmed = await confirmAsync({
      title: 'Reset to default?',
      message: "Your text is replaced by the app's.",
      action: 'Reset',
      destructive: true,
    });
    if (!isConfirmed) return;
    setText(DEFAULT_INSTRUCTIONS[kind]);
    haptics.success();
  }

  return (
    <TextEditScreen
      title={instructionText[kind].title}
      value={text}
      onChangeText={setText}
      onBlur={() => flush()}
      onBack={() => navigation.goBack()}
      placeholder="What the assistant is told"
      maxLength={INSTRUCTION_LIMITS.text}
      description={instructionText[kind].description}
      action={isChanged ? { label: 'Reset to default', tone: 'danger', onPress: handleReset } : null}
    />
  );
}
