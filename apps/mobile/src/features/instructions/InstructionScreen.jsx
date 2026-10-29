import { DEFAULT_INSTRUCTIONS, INSTRUCTION_LIMITS } from '@squidbox/shared';
import { useState } from 'react';

import instructionText from './instructionText';

import TextEditSheet from '@/components/TextEditSheet';
import useEditSheet from '@/hooks/useEditSheet';
import useLeaveWhenUnavailable from '@/hooks/useLeaveWhenUnavailable';
import useSeedOrClose from '@/hooks/useSeedOrClose';
import useLibrary from '@/library/useLibrary';
import { scale } from '@/styles/designTokens';
import { getDb } from '@/sync/db/client';
import { readInstructions, saveInstruction } from '@/sync/instructionsRepository';

// One kind of instructions (`{ kind }`) as a draft sheet: its text, the user's or the app's, saved on
// Save, and Reset to default while the draft differs from the app's (× undoes it, so no
// confirm). A root screen, one per kind.
export default function InstructionScreen({ route }) {
  const { kind } = route.params;
  const isAvailable = useLeaveWhenUnavailable();
  const { library } = useLibrary();
  const userId = library.owner.userId;
  const seed = useSeedOrClose(
    async (db) => ({ stored: (await readInstructions(db, userId))?.[kind] ?? null }),
    `${userId}:${kind}`,
  );
  if (!isAvailable || !seed) return null;
  return <InstructionEditor kind={kind} userId={userId} seed={seed} />;
}

function InstructionEditor({ kind, userId, seed }) {
  const initialText = seed.stored ?? DEFAULT_INSTRUCTIONS[kind];
  const [text, setText] = useState(initialText);
  const { sheetProps } = useEditSheet({ isValid: Boolean(text.trim()), isDirty: text.trim() !== initialText, save });

  const isChanged = text.trim() !== DEFAULT_INSTRUCTIONS[kind];

  // The default's text is stored as null.
  async function save() {
    await saveInstruction(getDb(), userId, kind, text.trim());
  }

  return (
    <TextEditSheet
      {...sheetProps}
      title={instructionText[kind].title}
      value={text}
      onChangeText={setText}
      placeholder="What the assistant is told"
      maxLength={INSTRUCTION_LIMITS.text}
      minHeight={scale(240)}
      description={instructionText[kind].description}
      actions={
        isChanged
          ? [{ label: 'Reset to default', tone: 'danger', onPress: () => setText(DEFAULT_INSTRUCTIONS[kind]) }]
          : null
      }
    />
  );
}
