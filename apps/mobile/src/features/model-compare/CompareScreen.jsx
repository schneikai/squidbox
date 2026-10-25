import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import FloatingPrimaryAction, { FLOATING_PRIMARY_ACTION_CLEARANCE } from './FloatingPrimaryAction';
import ModelAnswers from './ModelAnswers';
import PhotoAnswers from './PhotoAnswers';
import useCompareRound, { TEXT_KEY } from './useCompareRound';

import Card from '@/components/Card';
import Field from '@/components/Field';
import IntroText from '@/components/IntroText';
import ModalCloseButton from '@/components/ModalCloseButton';
import ModalHeader, { MODAL_HEADER_HEIGHT } from '@/components/ModalHeader';
import ModalSheet from '@/components/ModalSheet';
import PrimaryButton from '@/components/PrimaryButton';
import Textarea from '@/components/Textarea';
import { SCREEN_PADDING } from '@/constants';
import useScrollY from '@/hooks/useScrollY';
import { scale } from '@/styles/designTokens';
import { readPrompt, setPrompt } from '@/sync/aiStateRepository';
import { getDb, schema } from '@/sync/db/client';
import { readByIds } from '@/sync/readByIds';

// Each kind's prompt before the first compare; after it, the last one used.
const DEFAULT_PROMPTS = {
  writing: "Write 3 spicy tweets for my fans. Tease, don't tell. Under 200 characters each.",
  vision:
    "Tag this photo with 8 short, specific tags of what's in it: subject, clothing, setting, light, pose, " +
    "mood. Lowercase, 1 to 3 words each. Be explicit about adult content when it's there.",
};

/**
 * The blind compare (route params `kind`, the ticked `models` with their names and for vision the
 * `photoIds`). It waits for Start under its prompt (one for every photo), so the prompt can be
 * changed first. Each model's
 * answer is on a card labelled Model A, B, … in a fresh order each round, its name hidden. Writing
 * shows 3 tweets per model to thumb up; vision the tags per model per photo to mark as fitting, one
 * list row per photo. Both add up in the model list. X closes the whole compare.
 */
export default function CompareScreen({ navigation, route }) {
  const { kind, models, photoIds } = route.params;
  const isVision = kind === 'vision';
  const { scrollY, onScroll } = useScrollY();
  const { bottom } = useSafeAreaInsets();
  const [prompt, setPromptText] = useState(null); // null until the remembered one is read
  const [photos, setPhotos] = useState(null); // the photos' assets, null until read
  const savedPromptRef = useRef(null);
  const modelIds = useMemo(() => models.map(({ id }) => id), [models]);
  const round = useCompareRound({ kind, modelIds });

  const namesById = useMemo(() => Object.fromEntries(models.map(({ id, name }) => [id, name])), [models]);

  // Reads the remembered prompt, and for vision the photos. A read that fails goes back with why.
  useEffect(() => {
    let isCancelled = false;
    const readInput = Promise.all([
      readPrompt(getDb(), kind),
      isVision ? readByIds(getDb(), schema.assets, photoIds) : null,
    ]).then(([remembered, assets]) => {
      if (isCancelled) return;
      savedPromptRef.current = remembered;
      setPromptText(remembered ?? DEFAULT_PROMPTS[kind]);
      if (assets) setPhotos(assets);
    });
    readInput.catch((error) => {
      console.error('Reading the compare input failed', error);
      if (isCancelled) return;
      Alert.alert("Couldn't start the compare", error.message);
      navigation.goBack();
    });
    return () => {
      isCancelled = true;
    };
  }, []);

  const handleOpenPhoto = useCallback(
    (asset) => navigation.navigate('AssetScreen', { assetId: asset.id, query: { scope: { assetId: asset.id } } }),
    [navigation],
  );

  const hasStarted = round.number > 0;
  const canStart = !round.isRunning && !!prompt?.trim() && (!isVision || !!photos?.length);

  function handleStartRound() {
    // Remembered for next time, written only when it changed.
    if (prompt !== savedPromptRef.current) {
      savedPromptRef.current = prompt;
      setPrompt(getDb(), kind, prompt).catch((error) => console.error('Saving the prompt failed', error));
    }
    round.startRound({ prompt: prompt.trim(), photos });
  }

  function renderPrompt() {
    if (prompt === null) return null;
    return (
      <Card style={styles.promptCard}>
        <Field label="Prompt" description="Remembered for next time.">
          <Textarea value={prompt} onChangeText={setPromptText} minHeight={scale(72)} />
        </Field>
      </Card>
    );
  }

  function renderWritingAnswers() {
    return (
      <ModelAnswers
        answerKey={TEXT_KEY}
        kind={kind}
        letters={round.letters}
        namesById={namesById}
        results={round.results[TEXT_KEY]}
        taps={round.taps[TEXT_KEY]}
        roundNumber={round.number}
        toggle={round.toggle}
      />
    );
  }

  return (
    <ModalSheet>
      <ModalHeader
        leftSlot={<ModalCloseButton onPress={() => navigation.getParent().goBack()} />}
        centerSlot="Compare"
        scrollY={scrollY}
      />
      {/* A plain scroll view (at most VISION_COMPARE_MAX_PHOTOS rows): each photo row's offset in
          the content is its layout's y, which its sticky photo needs. */}
      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        automaticallyAdjustKeyboardInsets
        keyboardDismissMode="interactive"
        contentContainerStyle={[styles.content, { paddingBottom: bottom + FLOATING_PRIMARY_ACTION_CLEARANCE }]}
      >
        {renderPrompt()}
        {isVision && hasStarted && <IntroText style={styles.hint}>Tap the tags that fit.</IntroText>}
        {isVision
          ? photos?.map((asset) => (
              <PhotoAnswers
                key={asset.id}
                asset={asset}
                letters={round.letters}
                namesById={namesById}
                results={round.results[asset.id]}
                taps={round.taps[asset.id]}
                roundNumber={round.number}
                toggle={round.toggle}
                onOpenPhoto={handleOpenPhoto}
                scrollY={scrollY}
                stickyTop={MODAL_HEADER_HEIGHT}
              />
            ))
          : renderWritingAnswers()}
      </Animated.ScrollView>
      <FloatingPrimaryAction>
        <PrimaryButton
          icon={hasStarted ? 'repeat' : 'play'}
          label={!hasStarted ? 'Start' : isVision ? 'New tags' : 'New suggestions'}
          onPress={handleStartRound}
          loading={round.isRunning}
          disabled={!canStart}
        />
      </FloatingPrimaryAction>
    </ModalSheet>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: MODAL_HEADER_HEIGHT,
    paddingHorizontal: SCREEN_PADDING,
    gap: 12,
  },
  promptCard: {
    padding: 14,
  },
  hint: {
    paddingHorizontal: 4,
  },
});
