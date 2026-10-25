import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
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
import { readWritingPrompt, setWritingPrompt } from '@/sync/aiStateRepository';
import { getDb, schema } from '@/sync/db/client';
import { readByIds } from '@/sync/readByIds';

const DEFAULT_PROMPT = "Write 3 spicy tweets for my fans. Tease, don't tell. Under 200 characters each.";

/**
 * The blind compare (route params `kind`, the ticked `models` with their names and for vision the
 * `photoIds`): each model's answer on a card labelled Model A–D in a fresh order each round, its
 * name blurred. Writing shows 3 tweets per model to thumb up; vision 8 tags per model per photo to
 * mark as fitting, one list row per photo. Both add up in the model list. X closes the whole compare.
 */
export default function CompareScreen({ navigation, route }) {
  const { kind, models, photoIds } = route.params;
  const isVision = kind === 'vision';
  const { scrollY, onScroll } = useScrollY();
  const { bottom } = useSafeAreaInsets();
  const [prompt, setPrompt] = useState(null); // null until the remembered one is read
  const [photos, setPhotos] = useState(null); // the photos' assets, null until read
  const savedPromptRef = useRef(null);
  const modelIds = useMemo(() => models.map(({ id }) => id), [models]);
  const round = useCompareRound({ kind, modelIds });

  const namesById = useMemo(() => Object.fromEntries(models.map(({ id, name }) => [id, name])), [models]);

  // The first round starts once its input is in: the remembered prompt, or the photos. A read that
  // fails goes back with why; one that ends after the screen closed starts nothing.
  useEffect(() => {
    let isCancelled = false;
    const readInput = isVision
      ? readByIds(getDb(), schema.assets, photoIds).then((assets) => {
          if (isCancelled) return;
          setPhotos(assets);
          round.startRound({ photos: assets });
        })
      : readWritingPrompt(getDb()).then((remembered) => {
          if (isCancelled) return;
          savedPromptRef.current = remembered;
          setPrompt(remembered ?? DEFAULT_PROMPT);
          startWritingRound(remembered ?? DEFAULT_PROMPT);
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

  const renderPhoto = useCallback(
    ({ item: asset }) => (
      <PhotoAnswers
        asset={asset}
        letters={round.letters}
        namesById={namesById}
        results={round.results[asset.id]}
        taps={round.taps[asset.id]}
        roundNumber={round.number}
        toggle={round.toggle}
        onOpenPhoto={handleOpenPhoto}
      />
    ),
    [round.letters, round.results, round.taps, round.number, round.toggle, namesById, handleOpenPhoto],
  );

  const canStart = !round.isRunning && (isVision ? !!photos?.length : !!prompt?.trim());

  function startWritingRound(text) {
    // Remembered for next time, written only when it changed.
    if (text !== savedPromptRef.current) {
      savedPromptRef.current = text;
      setWritingPrompt(getDb(), text).catch((error) => console.error('Saving the prompt failed', error));
    }
    round.startRound({ prompt: text.trim() });
  }

  function handleNewRound() {
    if (isVision) round.startRound({ photos });
    else startWritingRound(prompt);
  }

  function renderWriting() {
    return (
      <>
        {prompt !== null && (
          <Card style={styles.promptCard}>
            <Field label="Prompt" description="Remembered for next time.">
              <Textarea value={prompt} onChangeText={setPrompt} minHeight={scale(72)} />
            </Field>
          </Card>
        )}
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
      </>
    );
  }

  return (
    <ModalSheet>
      <ModalHeader
        leftSlot={<ModalCloseButton onPress={() => navigation.getParent().goBack()} />}
        centerSlot="Compare"
        scrollY={scrollY}
      />
      <Animated.FlatList
        data={isVision ? (photos ?? []) : []}
        keyExtractor={(asset) => asset.id}
        renderItem={renderPhoto}
        ItemSeparatorComponent={Separator}
        ListHeaderComponent={
          isVision ? (
            <IntroText style={styles.hint}>Tap the tags that fit.</IntroText>
          ) : (
            <View style={styles.writing}>{renderWriting()}</View>
          )
        }
        ListHeaderComponentStyle={styles.header}
        onScroll={onScroll}
        scrollEventThrottle={16}
        automaticallyAdjustKeyboardInsets
        keyboardDismissMode="interactive"
        contentContainerStyle={[styles.content, { paddingBottom: bottom + FLOATING_PRIMARY_ACTION_CLEARANCE }]}
      />
      <FloatingPrimaryAction>
        <PrimaryButton
          icon="repeat"
          label={isVision ? 'New tags' : 'New suggestions'}
          onPress={handleNewRound}
          loading={round.isRunning}
          disabled={!canStart}
        />
      </FloatingPrimaryAction>
    </ModalSheet>
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  content: {
    paddingTop: MODAL_HEADER_HEIGHT,
    paddingHorizontal: SCREEN_PADDING,
  },
  header: {
    marginBottom: 12,
  },
  writing: {
    gap: 12,
  },
  promptCard: {
    padding: 14,
  },
  hint: {
    paddingHorizontal: 4,
  },
  separator: {
    height: 12,
  },
});
