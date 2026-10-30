import { COMPARE_PROMPT_MAX_LENGTH } from '@squidbox/shared';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import Animated from 'react-native-reanimated';

import ModelAnswers from './ModelAnswers';
import PhotoAnswers from './PhotoAnswers';
import useCompareRound, { TEXT_KEY } from './useCompareRound';

import Button from '@/components/Button';
import Card from '@/components/Card';
import Field from '@/components/Field';
import IntroText from '@/components/IntroText';
import ModalHeader, { MODAL_HEADER_HEIGHT } from '@/components/ModalHeader';
import ModalSheet from '@/components/ModalSheet';
import Textarea from '@/components/Textarea';
import FloatingPrimaryAction from '@/components/floating-bars/FloatingPrimaryAction';
import useFloatingPrimaryActionPadding from '@/components/floating-bars/useFloatingPrimaryActionPadding';
import { SCREEN_PADDING } from '@/constants';
import useScrollY from '@/hooks/useScrollY';
import useVeniceBalance from '@/hooks/useVeniceBalance';
import { scale } from '@/styles/designTokens';
import textareaTextStyle from '@/styles/textareaTextStyle';
import { setPrompt } from '@/sync/aiStateRepository';
import { getDb } from '@/sync/db/client';

// A long prompt shows its first lines until tapped, so the answers stay in view.
const PROMPT_FOLDED_LINES = 4;
const PROMPT_MIN_HEIGHT = scale(72);

/**
 * A blind compare of the `models` (`{ id, name }`) of `kind`, from `savedPrompt` (the last one
 * used, null before the first compare) and for vision the `photos`. It waits for Start under the
 * prompt (one for every photo), so the prompt can be changed first. Each model's answer is on a
 * card labelled Model A, B, … in a fresh order each round, its name hidden. Writing shows the
 * tweets per model to thumb up; vision the tags per model per photo to mark as fitting, one row per
 * photo. Both add up in the model list. X closes the whole compare.
 */
export default function CompareRound({ navigation, kind, models, savedPrompt, defaultPrompt, photos }) {
  const isVision = kind === 'vision';
  const { scrollY, onScroll } = useScrollY();
  const paddingBottom = useFloatingPrimaryActionPadding();
  const [prompt, setPromptText] = useState(savedPrompt ?? defaultPrompt);
  const [isEditingPrompt, setIsEditingPrompt] = useState(false);
  const savedPromptRef = useRef(savedPrompt);
  const modelIds = useMemo(() => models.map(({ id }) => id), [models]);
  const round = useCompareRound({ kind, modelIds });
  // Read again once a round has ended, so it shows what the round cost.
  const balance = useVeniceBalance(round.isRunning ? null : round.number);

  const namesById = useMemo(() => Object.fromEntries(models.map(({ id, name }) => [id, name])), [models]);

  const handleOpenPhoto = useCallback(
    (asset) => navigation.navigate('AssetScreen', { assetId: asset.id, query: { scope: { assetId: asset.id } } }),
    [navigation],
  );

  const hasStarted = round.number > 0;
  const canStart = !round.isRunning && !!prompt.trim() && (!isVision || photos.length > 0);

  function handleStartRound() {
    // Remembered for next time, written only when it changed.
    if (prompt !== savedPromptRef.current) {
      const saved = prompt;
      setPrompt(getDb(), kind, saved)
        .then(() => {
          savedPromptRef.current = saved;
        })
        .catch((error) => console.error('Saving the prompt failed', error));
    }
    round.startRound({ prompt: prompt.trim(), photos });
  }

  return (
    <ModalSheet>
      <ModalHeader
        leftSlot={<Button icon="close" accessibilityLabel="Close" onPress={() => navigation.getParent().goBack()} />}
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
        contentContainerStyle={[styles.content, { paddingBottom }]}
      >
        <Card style={styles.promptCard}>
          <Field label="Prompt" description="Remembered for next time.">
            {isEditingPrompt ? (
              <Textarea
                value={prompt}
                onChangeText={setPromptText}
                onBlur={() => setIsEditingPrompt(false)}
                maxLength={COMPARE_PROMPT_MAX_LENGTH}
                minHeight={PROMPT_MIN_HEIGHT}
                autoFocus
                style={styles.promptInput}
              />
            ) : (
              <Pressable
                onPress={() => setIsEditingPrompt(true)}
                accessibilityRole="button"
                accessibilityHint="Edits the prompt"
              >
                <Text style={[textareaTextStyle, styles.promptFolded]} numberOfLines={PROMPT_FOLDED_LINES}>
                  {prompt}
                </Text>
              </Pressable>
            )}
          </Field>
        </Card>
        <IntroText style={styles.hint}>Venice balance: {balance.value ?? '…'}</IntroText>
        {isVision && hasStarted && <IntroText style={styles.hint}>Tap the tags that fit.</IntroText>}
        {isVision ? (
          photos.map((asset) => (
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
        ) : (
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
        )}
      </Animated.ScrollView>
      <FloatingPrimaryAction>
        <Button
          variant="primary"
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
  // As the folded text, so the prompt doesn't move when the editing starts.
  promptInput: {
    padding: 0,
  },
  promptFolded: {
    minHeight: PROMPT_MIN_HEIGHT,
  },
  hint: {
    paddingHorizontal: 4,
  },
});
