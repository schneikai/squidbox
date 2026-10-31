import { INSTRUCTION_LIMITS } from '@squidbox/shared';
import { useState } from 'react';

import instructionText from './instructionText';
import missingPlaceholdersNote from './missingPlaceholdersNote';

import CatalogStatus from '@/components/CatalogStatus';
import EditSheet from '@/components/EditSheet';
import TextEditSheet from '@/components/TextEditSheet';
import useApplyChangesForEveryone from '@/hooks/useApplyChangesForEveryone';
import useEditSheet from '@/hooks/useEditSheet';
import useInstructions from '@/hooks/useInstructions';
import useLeaveWhenUnavailable from '@/hooks/useLeaveWhenUnavailable';
import useSeedOrClose from '@/hooks/useSeedOrClose';
import applyAppInstructions from '@/lib/applyAppInstructions';
import useLibrary from '@/library/useLibrary';
import { getDb } from '@/sync/db/client';
import { readInstructions, saveInstruction } from '@/sync/instructionsRepository';
import publishInstructionAsync from '@/utils/cloud-api/ai/publishInstructionAsync';

// One kind of instructions (`{ kind }`) as a draft sheet: its text, the user's override or the app's
// default, saved on Save. While the draft differs from the app's default: Apply changes for everyone
// (for a text that isn't empty), which publishes it for every account and closes the sheet, and
// Reset changes, which puts the default back in the draft (× undoes it, so no confirm). Until the
// user types, the draft is the stored text, and the app's default as it changes. It waits for
// the app's defaults (they come with the catalog). A root screen, one per kind.
export default function InstructionScreen({ route, navigation }) {
  const { kind } = route.params;
  const isAvailable = useLeaveWhenUnavailable('ai_admin');
  const { library } = useLibrary();
  const userId = library.owner.userId;
  const { defaultTexts, error, retry } = useInstructions();
  const seed = useSeedOrClose(
    async (db) => ({ stored: (await readInstructions(db, userId))?.[kind] ?? null }),
    `${userId}:${kind}`,
  );

  if (!isAvailable || !seed) return null;
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

// `defaultText` is the app's default as the catalog has it now (a publish replaces it at once).
// `draft` is null until the user types.
function InstructionEditor({ kind, userId, seed, defaultText }) {
  const [draft, setDraft] = useState(null);
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
  const actions = [
    isChanged &&
      trimmed !== '' && {
        label: 'Apply changes for everyone',
        colorPalette: 'accent',
        onPress: handlePublish,
        loading: isPublishing,
      },
    isChanged && { label: 'Reset changes', colorPalette: 'danger', onPress: handleReset },
  ].filter(Boolean);

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
      await finish(() => undefined, "Couldn't save your changes");
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
