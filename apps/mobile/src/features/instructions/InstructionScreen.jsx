import { INSTRUCTION_LIMITS } from '@squidbox/shared';
import { useState } from 'react';

import instructionText from './instructionText';

import Button from '@/components/Button';
import CatalogStatus from '@/components/CatalogStatus';
import DetailScrollView from '@/components/DetailScrollView';
import ModalHeader from '@/components/ModalHeader';
import ModalSheet from '@/components/ModalSheet';
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
import { requestSync } from '@/sync/worker';
import publishInstructionAsync from '@/utils/cloud-api/ai/publishInstructionAsync';

// One kind of instructions (`{ kind }`) as a draft sheet: its text, the user's override or the app's
// default, saved on Save. While the draft differs from the app's default: Apply changes for everyone
// (for a text that isn't empty), which publishes it for every account and closes the sheet, and
// Reset changes, which puts the default back in the draft (× undoes it, so no confirm). It waits for
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
      <ModalSheet>
        <ModalHeader
          leading={<Button icon="close" accessibilityLabel="Close" onPress={() => navigation.goBack()} />}
          title={instructionText[kind].title}
        />
        <DetailScrollView>
          <CatalogStatus title="Couldn't load the instructions" error={error} retry={retry} />
        </DetailScrollView>
      </ModalSheet>
    );
  }
  return <InstructionEditor kind={kind} userId={userId} seed={seed} defaultText={defaultTexts[kind]} />;
}

// `defaultText` is the app's default as the catalog has it now (a publish replaces it at once).
function InstructionEditor({ kind, userId, seed, defaultText }) {
  const initialText = seed.stored ?? defaultText;
  const [text, setText] = useState(initialText);
  const { isPublishing, publish } = useApplyChangesForEveryone();
  const { sheetProps, leave } = useEditSheet({
    isValid: text.trim() !== '',
    isDirty: text.trim() !== initialText.trim(),
    save,
  });

  const isChanged = text.trim() !== defaultText;
  const actions = [
    isChanged &&
      text.trim() !== '' && {
        label: 'Apply changes for everyone',
        colorPalette: 'accent',
        onPress: handlePublish,
        loading: isPublishing,
      },
    isChanged && { label: 'Reset changes', colorPalette: 'danger', onPress: () => setText(defaultText) },
  ].filter(Boolean);

  // The default's text is stored as null.
  async function save() {
    await saveInstruction(getDb(), userId, kind, text.trim(), defaultText);
  }

  // The text becomes the default for every account, so the account's own text is cleared and
  // nothing is left to save: the sheet closes.
  function handlePublish() {
    return publish("Every account's assistant gets this text.", async () => {
      const answer = await publishInstructionAsync(kind, { text: text.trim() });
      applyAppInstructions(answer);
      await saveInstruction(getDb(), userId, kind, null, answer.instructions[kind]);
      requestSync();
      leave();
    });
  }

  return (
    <TextEditSheet
      {...sheetProps}
      title={instructionText[kind].title}
      value={text}
      onChangeText={setText}
      placeholder="What the assistant is told"
      maxLength={INSTRUCTION_LIMITS.text}
      description={instructionText[kind].description}
      actions={actions}
    />
  );
}
