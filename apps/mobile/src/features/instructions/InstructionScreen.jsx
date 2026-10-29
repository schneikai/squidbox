import { INSTRUCTION_LIMITS } from '@squidbox/shared';
import { useState } from 'react';
import { Alert } from 'react-native';

import instructionText from './instructionText';

import CatalogStatus from '@/components/CatalogStatus';
import DetailScrollView from '@/components/DetailScrollView';
import Page from '@/components/Page';
import TextEditScreen from '@/components/TextEditScreen';
import FloatingDetailHeader from '@/components/floating-bars/FloatingDetailHeader';
import useAiCatalog from '@/hooks/useAiCatalog';
import useHaptics from '@/hooks/useHaptics';
import useLeaveWhenUnavailable from '@/hooks/useLeaveWhenUnavailable';
import useSaveAsYouType from '@/hooks/useSaveAsYouType';
import useSeedOrClose from '@/hooks/useSeedOrClose';
import applyAiCatalog from '@/lib/applyAiCatalog';
import useLibrary from '@/library/useLibrary';
import { getDb } from '@/sync/db/client';
import { readInstructions, saveInstruction } from '@/sync/instructionsRepository';
import { requestSync } from '@/sync/worker';
import publishInstructionAsync from '@/utils/cloud-api/ai/publishInstructionAsync';
import apiErrorMessage from '@/utils/cloud-api/apiErrorMessage';
import confirmAsync from '@/utils/confirmAsync';

// One kind of instructions (`{ kind }`): its text, the user's override or the app's default (the
// published text, else the built-in one), saved as you type. While it differs from the app's
// default: Make default for everyone, which publishes it for every account, and Reset to default. It
// waits for the app's defaults (they come with the catalog). A root screen, one per kind.
export default function InstructionScreen({ route, navigation }) {
  const { kind } = route.params;
  const isAvailable = useLeaveWhenUnavailable();
  const { library } = useLibrary();
  const userId = library.owner.userId;
  const { instructions, error, retry } = useAiCatalog();
  const seed = useSeedOrClose(
    async (db) => ({ stored: (await readInstructions(db, userId))?.[kind] ?? null }),
    `${userId}:${kind}`,
  );

  if (!isAvailable || !seed) return null;
  if (!instructions) {
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
      initialDefaultText={instructions[kind]}
      navigation={navigation}
    />
  );
}

function InstructionEditor({ kind, userId, seed, initialDefaultText, navigation }) {
  const haptics = useHaptics();
  // The app's default as the editor opened, or as this admin published it: another admin's publish
  // shows on reopening.
  const [defaultText, setDefaultText] = useState(initialDefaultText);
  const [text, setText] = useState(seed.stored ?? initialDefaultText);
  const [isPublishing, setIsPublishing] = useState(false);
  const { flush } = useSaveAsYouType(text.trim(), saveText);

  const isChanged = text.trim() !== defaultText;
  const actions = isChanged
    ? [
        { label: 'Make default for everyone', tone: 'accent', onPress: handlePublish, loading: isPublishing },
        { label: 'Reset to default', tone: 'danger', onPress: handleReset },
      ]
    : [];

  // An empty text isn't saved (Reset is the way back to the default); the default's text is stored
  // as null.
  async function saveText(next) {
    if (!next) return false;
    await saveInstruction(getDb(), userId, kind, next, defaultText);
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
    setText(defaultText);
    haptics.success();
  }

  // The text becomes the default for every account; this account's override, now equal to it, is
  // stored as null. A text typed meanwhile is saved against the new default, so it stays (and one
  // saved during the request isn't cleared).
  async function handlePublish() {
    const isConfirmed = await confirmAsync({
      title: 'Make default for everyone?',
      message: "Every account's assistant gets this text. Admins who changed theirs keep their own.",
      action: 'Make default for everyone',
    });
    if (!isConfirmed) return;
    setIsPublishing(true);
    try {
      await flush();
      const catalog = await publishInstructionAsync(kind, { text: text.trim() });
      applyAiCatalog(catalog);
      const published = catalog.instructions[kind];
      setDefaultText(published);
      const db = getDb();
      if ((await readInstructions(db, userId))?.[kind] === published) {
        await saveInstruction(db, userId, kind, published, published);
      }
      requestSync();
      haptics.success();
    } catch (error) {
      haptics.error();
      Alert.alert("Couldn't make it the default for everyone", apiErrorMessage(error));
    } finally {
      setIsPublishing(false);
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
      description={instructionText[kind].description}
      actions={actions}
    />
  );
}
