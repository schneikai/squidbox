import { DEFAULT_INSTRUCTIONS, INSTRUCTION_LIMITS } from '@squidbox/shared';
import { useState } from 'react';
import { Alert } from 'react-native';

import instructionText from './instructionText';

import TextEditScreen from '@/components/TextEditScreen';
import useHaptics from '@/hooks/useHaptics';
import useLeaveWhenUnavailable from '@/hooks/useLeaveWhenUnavailable';
import useSaveAsYouType from '@/hooks/useSaveAsYouType';
import useSeedOrClose from '@/hooks/useSeedOrClose';
import useLibrary from '@/library/useLibrary';
import { scale } from '@/styles/designTokens';
import { getDb } from '@/sync/db/client';
import { readInstructions, saveInstruction } from '@/sync/instructionsRepository';
import { requestSync } from '@/sync/worker';
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
  const flush = useSaveAsYouType(text.trim(), saveText);

  const isChanged = text.trim() !== DEFAULT_INSTRUCTIONS[kind];

  // An empty text isn't saved (Reset is the way back to the default); the default's text is stored
  // as null.
  async function saveText(next) {
    if (!next) return false;
    await saveInstruction(getDb(), userId, kind, next);
    requestSync();
    return true;
  }

  async function handleReset() {
    const isConfirmed = await confirmAsync({
      title: 'Reset to default?',
      message: "Your text is replaced by the app's.",
      action: 'Reset',
      destructive: true,
    });
    if (!isConfirmed) return;
    try {
      // The default's text saves as null, like any text equal to it.
      setText(DEFAULT_INSTRUCTIONS[kind]);
      await saveInstruction(getDb(), userId, kind, null);
      requestSync();
      haptics.success();
    } catch (error) {
      console.error('Resetting the instructions failed', error);
      haptics.error();
      Alert.alert("Couldn't reset the instructions", error.message);
    }
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
      minHeight={scale(240)}
      description={`${instructionText[kind].description}. The reply format (how many posts, JSON) is added by the app and can't be changed.`}
      action={isChanged ? { label: 'Reset to default', tone: 'danger', onPress: handleReset } : null}
    />
  );
}
