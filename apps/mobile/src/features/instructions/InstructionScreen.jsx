import { INSTRUCTION_LIMITS } from '@squidbox/shared';
import { useState } from 'react';

import instructionText from './instructionText';

import CatalogStatus from '@/components/CatalogStatus';
import DetailScrollView from '@/components/DetailScrollView';
import Page from '@/components/Page';
import TextEditScreen from '@/components/TextEditScreen';
import FloatingDetailHeader from '@/components/floating-bars/FloatingDetailHeader';
import useHaptics from '@/hooks/useHaptics';
import useInstructions from '@/hooks/useInstructions';
import useLeaveWhenUnavailable from '@/hooks/useLeaveWhenUnavailable';
import useMakeDefaultForEveryone from '@/hooks/useMakeDefaultForEveryone';
import useSaveAsYouType from '@/hooks/useSaveAsYouType';
import useSeedOrClose from '@/hooks/useSeedOrClose';
import applyAppInstructions from '@/lib/applyAppInstructions';
import useLibrary from '@/library/useLibrary';
import { getDb } from '@/sync/db/client';
import { readInstructions, saveInstruction } from '@/sync/instructionsRepository';
import publishInstructionAsync from '@/utils/cloud-api/ai/publishInstructionAsync';
import confirmAsync from '@/utils/confirmAsync';

// One kind of instructions (`{ kind }`): its text, the user's override or the app's default, saved
// as you type. While it differs from the app's default: Make default for everyone (for a text that
// isn't empty), which publishes it for every account, and Reset to default. It waits for the app's
// defaults (they come with the catalog). A root screen, one per kind.
export default function InstructionScreen({ route, navigation }) {
  const { kind } = route.params;
  const isAvailable = useLeaveWhenUnavailable();
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
      <Page>
        <FloatingDetailHeader title={instructionText[kind].title} onBack={() => navigation.goBack()} />
        <DetailScrollView>
          <CatalogStatus title="Couldn't load the instructions" error={error} retry={retry} />
        </DetailScrollView>
      </Page>
    );
  }
  return (
    <InstructionEditor
      kind={kind}
      userId={userId}
      seed={seed}
      defaultText={defaultTexts[kind]}
      navigation={navigation}
    />
  );
}

// `defaultText` is the app's default as the catalog has it now (a publish replaces it at once). The
// draft is the account's override only, null while it has none, so the text shown follows the
// default until the user types.
function InstructionEditor({ kind, userId, seed, defaultText, navigation }) {
  const haptics = useHaptics();
  const [draft, setDraft] = useState(seed.stored);
  const { isPublishing, publish } = useMakeDefaultForEveryone();
  const { flush } = useSaveAsYouType(draft === null ? null : draft.trim(), saveText);

  const text = draft ?? defaultText;
  const isChanged = text.trim() !== defaultText;
  const actions = [
    isChanged &&
      text.trim() !== '' && {
        label: 'Make default for everyone',
        tone: 'accent',
        onPress: handlePublish,
        loading: isPublishing,
      },
    isChanged && { label: 'Reset to default', tone: 'danger', onPress: handleReset },
  ].filter(Boolean);

  // An empty text isn't saved (Reset is the way back to the default); null and the default's text
  // are stored as null.
  async function saveText(next) {
    if (next === '') return false;
    await saveInstruction(getDb(), userId, kind, next, defaultText);
    return true;
  }

  // Back to the app's default, saved as you type like any other edit (as null).
  async function handleReset() {
    const isConfirmed = await confirmAsync({
      title: 'Reset to default?',
      message: "Your text is replaced by the app's.",
      action: 'Reset',
      destructive: true,
    });
    if (!isConfirmed) return;
    setDraft(null);
    haptics.success();
  }

  // The text becomes the default for every account. The draft, now equal to it, goes back to null
  // (the override is cleared as you type); a text typed meanwhile stays.
  function handlePublish() {
    return publish("Every account's assistant gets this text.", async () => {
      await flush();
      const answer = await publishInstructionAsync(kind, { text: text.trim() });
      applyAppInstructions(answer);
      const published = answer.instructions[kind];
      setDraft((current) => (current?.trim() === published ? null : current));
    });
  }

  return (
    <TextEditScreen
      title={instructionText[kind].title}
      value={text}
      onChangeText={setDraft}
      onBlur={() => flush()}
      onBack={() => navigation.goBack()}
      placeholder="What the assistant is told"
      maxLength={INSTRUCTION_LIMITS.text}
      description={instructionText[kind].description}
      actions={actions}
    />
  );
}
