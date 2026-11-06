import { INSTRUCTION_LIMITS, type InstructionKind, instructionKindSchema } from '@squidbox/shared';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import { useState } from 'react';

import instructionText from './instructionText';
import missingPlaceholdersNote from './missingPlaceholdersNote';

import type { ActionButtonsProps } from '@/components/ActionButtons';
import CatalogStatus from '@/components/CatalogStatus';
import EditSheet from '@/components/EditSheet';
import TextEditSheet from '@/components/TextEditSheet';
import useApplyChangesForEveryone from '@/hooks/useApplyChangesForEveryone';
import useAvailableUserId from '@/hooks/useAvailableUserId';
import useCloseWhen from '@/hooks/useCloseWhen';
import useEditSheet from '@/hooks/useEditSheet';
import useInstructions from '@/hooks/useInstructions';
import useSeedOrClose from '@/hooks/useSeedOrClose';
import applyAppInstructions from '@/lib/applyAppInstructions';
import { getDb } from '@/sync/db/client';
import { readInstructions, saveInstruction } from '@/sync/instructionsRepository';
import publishInstructionAsync from '@/utils/cloud-api/ai/publishInstructionAsync';

// One kind of instructions (`{ kind }`) as a draft sheet: its text, the user's override or the app's
// default, saved on Save. While the draft differs from the app's default: Apply changes for everyone
// (for a text that isn't empty), which publishes it for every account and closes the sheet, and
// Reset changes, which puts the default back in the draft (× undoes it, so no confirm). Until the
// user types, the draft is the stored text, and the app's default as it changes. It waits for
// the app's defaults (they come with the catalog). A root screen, one per kind; a link to a kind
// that doesn't exist (an old link, a renamed kind) closes it.
export default function InstructionScreen() {
  const params = useLocalSearchParams<{ kind: string }>();
  const kind = instructionKindSchema.safeParse(params.kind);
  const userId = useAvailableUserId('ai_admin');
  // Only while available: useAvailableUserId closes it otherwise.
  useCloseWhen(userId !== null && !kind.success);

  if (!kind.success || userId === null) return null;
  return <InstructionSheet kind={kind.data} userId={userId} />;
}

type InstructionSheetProps = { kind: InstructionKind; userId: string };

// The sheet once the kind and the account are known: the stored text, then the editor once the
// app's defaults are in.
function InstructionSheet({ kind, userId }: InstructionSheetProps) {
  const navigation = useNavigation();
  const { defaultTexts, error, retry } = useInstructions();
  const seed = useSeedOrClose(
    async (db): Promise<InstructionSeed> => ({ stored: (await readInstructions(db, userId))?.[kind] ?? null }),
    `${userId}:${kind}`,
  );

  if (!seed) return null;
  if (!defaultTexts) {
    return (
      <EditSheet
        title={instructionText[kind].title}
        confirmLabel="Save"
        canConfirm={false}
        onCancel={() => navigation.goBack()}
      >
        <CatalogStatus title="Couldn't load the instructions" error={error} retry={retry} />
      </EditSheet>
    );
  }
  return <InstructionEditor kind={kind} userId={userId} seed={seed} defaultText={defaultTexts[kind]} />;
}

type InstructionSeed = { stored: string | null };

type InstructionEditorProps = { kind: InstructionKind; userId: string; seed: InstructionSeed; defaultText: string };

// `defaultText` is the app's default as the catalog has it now (a publish replaces it at once).
// `draft` is null until the user types.
function InstructionEditor({ kind, userId, seed, defaultText }: InstructionEditorProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const { isPublishing, publish } = useApplyChangesForEveryone();
  const storedText = seed.stored ?? defaultText;
  const text = draft ?? storedText;
  const { sheetProps, finish } = useEditSheet({
    isValid: text.trim() !== '',
    isDirty: draft != null && draft.trim() !== storedText.trim(),
    save,
    isBusy: isPublishing,
  });

  const trimmed = text.trim();
  const isChanged = trimmed !== defaultText;
  const actions: ActionButtonsProps['actions'] = [];
  if (isChanged && trimmed !== '') {
    actions.push({
      label: 'Apply changes for everyone',
      colorPalette: 'accent',
      onPress: handlePublish,
      loading: isPublishing,
    });
  }
  if (isChanged) actions.push({ label: 'Reset changes', colorPalette: 'danger', onPress: handleReset });

  // With no text of the account's own stored, the draft follows the default again.
  function handleReset() {
    setDraft(seed.stored == null ? null : defaultText);
  }

  // The default's text is stored as null.
  async function save() {
    await saveInstruction(getDb(), userId, kind, trimmed, defaultText);
  }

  // The text becomes the default for every account, so the account's own text is cleared and
  // nothing is left to save: the sheet closes. A failing clear fails the publish's run, which says so.
  function handlePublish() {
    return publish("Every account's assistant gets this text.", async () => {
      const answer = await publishInstructionAsync(kind, { text: trimmed });
      applyAppInstructions(answer);
      await saveInstruction(getDb(), userId, kind, null, answer.instructions[kind]);
      await finish(async () => undefined, "Couldn't save your changes");
    });
  }

  return (
    <TextEditSheet
      {...sheetProps}
      title={instructionText[kind].title}
      value={text}
      onChangeText={setDraft}
      placeholder="What the assistant is told"
      maxLength={INSTRUCTION_LIMITS.text}
      description={instructionText[kind].description}
      note={missingPlaceholdersNote(kind, text)}
      actions={actions}
    />
  );
}
