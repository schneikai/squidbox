import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import ModelCard from './ModelCard';
import PinnedAction, { PINNED_ACTION_CLEARANCE } from './PinnedAction';
import TagChip from './TagChip';
import TweetRow from './TweetRow';
import { readWritingPrompt, setWritingPrompt } from './aiState';
import useCompareRound, { TEXT_KEY } from './useCompareRound';

import Card from '@/components/Card';
import CoverImage from '@/components/CoverImage';
import Field from '@/components/Field';
import ModalCloseButton from '@/components/ModalCloseButton';
import ModalHeader, { MODAL_HEADER_HEIGHT } from '@/components/ModalHeader';
import ModalSheet from '@/components/ModalSheet';
import PrimaryButton from '@/components/PrimaryButton';
import Textarea from '@/components/Textarea';
import ThumbnailBadge from '@/components/ThumbnailBadge';
import { SCREEN_PADDING } from '@/constants';
import useScrollY from '@/hooks/useScrollY';
import { colors, scale, typography } from '@/styles/designTokens';
import { getDb, schema } from '@/sync/db/client';
import { readByIds } from '@/sync/readByIds';

const DEFAULT_PROMPT = "Write 3 spicy tweets for my fans. Tease, don't tell. Under 200 characters each.";
const PHOTO_SIZE = scale(96);

/**
 * The blind compare (route params `kind`, `models` with their names, the ticked `modelIds` and for
 * vision the `photoIds`): each model's answer on a card labelled Model A–D in a fresh order each
 * round, its name blurred. Writing shows 3 tweets per model to thumb up; vision 8 tags per model
 * per photo to mark as fitting. Both add up in the model list. X closes the whole compare.
 */
export default function CompareScreen({ navigation, route }) {
  const { kind, models, modelIds, photoIds } = route.params;
  const isVision = kind === 'vision';
  const { scrollY, onScroll } = useScrollY();
  const { bottom } = useSafeAreaInsets();
  const [prompt, setPrompt] = useState(null); // null until the remembered one is read
  const [photos, setPhotos] = useState(null); // the photos' assets, null until read
  const round = useCompareRound({ kind, modelIds });

  // The first round starts once its input is in: the remembered prompt, or the photos.
  useEffect(() => {
    if (isVision) {
      readByIds(getDb(), schema.assets, photoIds).then((assets) => {
        setPhotos(assets);
        round.startRound({ photos: assets });
      });
    } else {
      readWritingPrompt(getDb()).then((remembered) => {
        setPrompt(remembered ?? DEFAULT_PROMPT);
        startWritingRound(remembered ?? DEFAULT_PROMPT);
      });
    }
  }, []);

  const namesById = Object.fromEntries(models.map(({ id, name }) => [id, name]));
  const canStart = !round.isRunning && (isVision ? !!photos?.length : !!prompt?.trim());

  function startWritingRound(text) {
    setWritingPrompt(getDb(), text);
    round.startRound({ prompt: text.trim() });
  }

  function handleNewRound() {
    if (isVision) round.startRound({ photos });
    else startWritingRound(prompt);
  }

  function handleOpenPhoto(asset) {
    navigation.navigate('AssetScreen', { assetId: asset.id, query: { scope: { assetId: asset.id } } });
  }

  function renderCards(key, renderItems) {
    const results = round.results[key] ?? {};
    return round.letters.map(({ modelId, label }) => (
      <ModelCard key={`${round.number}-${modelId}`} label={label} name={namesById[modelId]} result={results[modelId]}>
        {renderItems(results[modelId]?.items ?? [], round.taps[key]?.[modelId] ?? [], modelId)}
      </ModelCard>
    ));
  }

  function renderTweets(tweets, liked, modelId) {
    return tweets.map((tweet, index) => (
      <TweetRow
        key={index}
        text={tweet}
        isLiked={liked.includes(index)}
        onToggle={() => round.toggle(TEXT_KEY, modelId, index)}
      />
    ));
  }

  function renderPhoto(asset) {
    return (
      <View key={asset.id} style={styles.photoRow}>
        <Pressable
          onPress={() => handleOpenPhoto(asset)}
          accessibilityRole="imagebutton"
          accessibilityLabel="Open photo"
        >
          <CoverImage asset={asset} style={styles.photo}>
            <ThumbnailBadge icon="expand" style={styles.expand} />
          </CoverImage>
        </Pressable>
        <View style={styles.photoCards}>
          {renderCards(asset.id, (tags, fitting, modelId) => (
            <View style={styles.tags}>
              {tags.map((tag, index) => (
                <TagChip
                  key={index}
                  label={tag}
                  isOn={fitting.includes(index)}
                  onToggle={() => round.toggle(asset.id, modelId, index)}
                />
              ))}
            </View>
          ))}
        </View>
      </View>
    );
  }

  return (
    <ModalSheet>
      <ModalHeader
        leftSlot={<ModalCloseButton onPress={() => navigation.getParent().goBack()} />}
        centerSlot="Compare"
        scrollY={scrollY}
      />
      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        automaticallyAdjustKeyboardInsets
        keyboardDismissMode="interactive"
        contentContainerStyle={[styles.content, { paddingBottom: bottom + PINNED_ACTION_CLEARANCE + SCREEN_PADDING }]}
      >
        {isVision ? (
          <>
            <Text style={styles.hint}>Tap the tags that fit.</Text>
            {photos?.map(renderPhoto)}
          </>
        ) : (
          <>
            {prompt !== null && (
              <Card style={styles.promptCard}>
                <Field label="Prompt" description="Remembered for next time.">
                  <Textarea value={prompt} onChangeText={setPrompt} minHeight={scale(72)} />
                </Field>
              </Card>
            )}
            {renderCards(TEXT_KEY, renderTweets)}
          </>
        )}
      </Animated.ScrollView>
      <PinnedAction>
        <PrimaryButton
          icon="repeat"
          label={isVision ? 'New tags' : 'New suggestions'}
          onPress={handleNewRound}
          loading={round.isRunning}
          disabled={!canStart}
        />
      </PinnedAction>
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
    fontSize: typography.footnote,
    color: colors.text.secondary,
    paddingHorizontal: 4,
  },
  photoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  photo: {
    width: PHOTO_SIZE,
    height: PHOTO_SIZE,
  },
  expand: {
    position: 'absolute',
    right: 6,
    bottom: 6,
  },
  photoCards: {
    flex: 1,
    gap: 12,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
});
