import AsyncStorage from '@react-native-async-storage/async-storage';
import { useState, useRef, useEffect } from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, PanResponder, ActivityIndicator } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, runOnJS } from 'react-native-reanimated';

import lastPostedText from './lastPostedText';
import readLastPosted, { lastPostedTables } from './readLastPosted';
import useRandomSuggestions from './useRandomSuggestions';

import AssetImage from '@/components/AssetImage';
import Card from '@/components/Card';
import EmptyState from '@/components/EmptyState';
import Icon from '@/components/Icon';
import IconButton from '@/components/IconButton';
import IconMenuButton from '@/components/IconMenuButton';
import ModalCloseButton from '@/components/ModalCloseButton';
import ModalHeader, { MODAL_HEADER_HEIGHT } from '@/components/ModalHeader';
import ModalSheet from '@/components/ModalSheet';
import PrimaryButton from '@/components/PrimaryButton';
import SuperPressable from '@/components/SuperPressable';
import Textarea from '@/components/Textarea';
import ThumbnailRow from '@/components/ThumbnailRow';
import MenuOption from '@/components/popup-menu-options/MenuOption';
import { MIN_REREAD_INTERVAL, SCREEN_PADDING } from '@/constants';
import ModelSelectorButton from '@/features/ai-suggestions/ModelSelectorButton';
import {
  DEFAULT_MODEL,
  DEFAULT_RANDOM_TWEETS_PROMPT,
  RANDOM_TWEETS_PROMPT_STORAGE_KEY,
  SYSTEM_PROMPT_STORAGE_KEY,
  DEFAULT_SYSTEM_PROMPT,
} from '@/features/ai-suggestions/aiSuggestionsStorage';
import resolveModel from '@/features/ai-suggestions/resolveModel';
import sampleReferencePosts from '@/features/ai-suggestions/sampleReferencePosts';
import sendAiMessageAsync from '@/features/ai-suggestions/sendAiMessageAsync';
import assetQuery from '@/features/asset-list/assetQuery';
import { colors, motion, radii, scale, typography } from '@/styles/designTokens';
import { getDb, schema } from '@/sync/db/client';
import { readPostTexts } from '@/sync/postsRepository';
import { readByIds } from '@/sync/readByIds';
import { useLiveQuery } from '@/sync/useLiveQuery';
import { MEDIA_TYPES } from '@/utils/assets/constants';
import formatVideoDuration from '@/utils/formatVideoDuration';

const TWEET_BATCH_SIZE = 10;
const SWIPE_THRESHOLD = 50;
const PROMPT_FOCUS_DELAY_MS = 100;
const POOL_SIZE = 50;
const NO_POOL = { ids: [], rows: [] };
// Swapping cards is a quick fade-through: the old one exits, the new one enters at the fast duration.
const SWAP_IN = { ...motion.enter, duration: motion.duration.fast };

// The sheet of useRandomSuggestions: a random asset and AI captions to start a post from. Use hands
// the shown ones to the caller; a tap on the asset opens its screen on this sheet's stack.
export default function RandomSuggestionsScreen({ route, navigation }) {
  const { callerKey } = route.params;
  const { finishRandomSuggestions } = useRandomSuggestions();
  const modelPickerRef = useRef(null);
  const promptInputRef = useRef(null);
  const [selectedModel, setSelectedModel] = useState(DEFAULT_MODEL);
  const [showEditPrompt, setShowEditPrompt] = useState(false);
  const [editablePrompt, setEditablePrompt] = useState('');
  // Filter state (type: exclusive All/Images/Videos; favorites: additive)
  const [showImages, setShowImages] = useState(true);
  const [showVideos, setShowVideos] = useState(true);
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  // Asset pool: a random draw when the sheet opens or a filter changes, refilled past its end (not on
  // every library write). A draw is shown once its rows are read, so the card never goes blank; after
  // a write the rows are read again, so an asset deleted meanwhile is skipped.
  const [pool, setPool] = useState(NO_POOL);
  const [assetIndex, setAssetIndex] = useState(0);
  const livePool = useLiveQuery(
    async (db) => ({ draw: pool.ids.join(), rows: await readByIds(db, schema.assets, pool.ids) }),
    [schema.assets],
    [pool.ids],
    { waitForWrite: true }, // the draw just read its rows
  );
  const [textPool, setTextPool] = useState([]);
  const [textIndex, setTextIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  // Closing the sheet without Use (the close button, a swipe down) suggests nothing.
  useEffect(() => () => finishRandomSuggestions(callerKey, null), [finishRandomSuggestions, callerKey]);

  useEffect(() => {
    let isCancelled = false;
    drawPool().then((drawn) => !isCancelled && setPool(drawn));
    setAssetIndex(0);
    return () => {
      isCancelled = true;
    };
  }, [showImages, showVideos, onlyFavorites]);

  useEffect(() => {
    fetchTextBatch().then(setTextPool);
    resolveModel().then(setSelectedModel);
  }, []);

  const mediaOpacity = useSharedValue(1);
  const mediaTranslateX = useSharedValue(0);
  const textOpacity = useSharedValue(1);
  const textTranslateX = useSharedValue(0);

  const mediaAnimStyle = useAnimatedStyle(() => ({
    opacity: mediaOpacity.value,
    transform: [{ translateX: mediaTranslateX.value }],
  }));

  const textAnimStyle = useAnimatedStyle(() => ({
    opacity: textOpacity.value,
    transform: [{ translateX: textTranslateX.value }],
  }));

  // Refs to avoid stale closures in PanResponder
  const navigateAssetRef = useRef(navigateAsset);
  const navigateTextRef = useRef(navigateText);
  navigateAssetRef.current = navigateAsset;
  navigateTextRef.current = navigateText;

  const mediaPanHandlers = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dx) > 10 && Math.abs(gs.dx) > Math.abs(gs.dy),
      onPanResponderRelease: (_, gs) => {
        if (gs.dx < -SWIPE_THRESHOLD) navigateAssetRef.current('next');
        else if (gs.dx > SWIPE_THRESHOLD) navigateAssetRef.current('prev');
      },
    }),
  ).current.panHandlers;

  const textPanHandlers = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dx) > 10 && Math.abs(gs.dx) > Math.abs(gs.dy),
      onPanResponderRelease: (_, gs) => {
        if (gs.dx < -SWIPE_THRESHOLD) navigateTextRef.current('next');
        else if (gs.dx > SWIPE_THRESHOLD) navigateTextRef.current('prev');
      },
    }),
  ).current.panHandlers;

  const poolQuery = assetQuery({
    scope: 'library',
    sort: 'random',
    filter: poolFilter({ showImages, showVideos, onlyFavorites }),
  });
  const assetPool = pool.ids;
  const rows = livePool?.draw === pool.ids.join() ? livePool.rows : pool.rows;
  const assets = new Map(rows.map((asset) => [asset.id, asset]));
  // Assets deleted while the sheet is open (e.g. by a sync) are skipped, not shown.
  const currentIndex = findLiveIndex(assetPool, assets, assetIndex, 1);
  const currentAsset = currentIndex >= 0 ? assets.get(assetPool[currentIndex]) : null;
  const hasOtherAssets = currentIndex >= 0 && findLiveIndex(assetPool, assets, currentIndex + 1, 1) !== currentIndex;
  const currentText = textPool[textIndex] ?? null;
  const allTypesActive = showImages && showVideos;

  async function openEditPrompt() {
    const stored = await AsyncStorage.getItem(RANDOM_TWEETS_PROMPT_STORAGE_KEY);
    setEditablePrompt(stored ?? DEFAULT_RANDOM_TWEETS_PROMPT);
    setShowEditPrompt(true);
  }

  async function handleSavePrompt() {
    const value = editablePrompt.trim() || DEFAULT_RANDOM_TWEETS_PROMPT;
    await AsyncStorage.setItem(RANDOM_TWEETS_PROMPT_STORAGE_KEY, value);
    setShowEditPrompt(false);
    setTextPool([]);
    setTextIndex(0);
    fetchTextBatch().then(setTextPool);
  }

  async function drawPool() {
    const db = getDb();
    const ids = await poolQuery.ids(db, { limit: POOL_SIZE });
    return { ids, rows: await readByIds(db, schema.assets, ids) };
  }

  // Fetches one batch of captions. Callers decide where the batch goes.
  async function fetchTextBatch() {
    setIsLoading(true);
    try {
      const [storedPrompt, model, storedSystemPrompt, recentPostTexts] = await Promise.all([
        AsyncStorage.getItem(RANDOM_TWEETS_PROMPT_STORAGE_KEY),
        resolveModel(),
        AsyncStorage.getItem(SYSTEM_PROMPT_STORAGE_KEY),
        readPostTexts(getDb()),
      ]);
      const stylePrompt = (storedPrompt ?? DEFAULT_RANDOM_TWEETS_PROMPT).trim();
      const systemPrompt = storedSystemPrompt ?? DEFAULT_SYSTEM_PROMPT;
      return await sendAiMessageAsync(
        [{ role: 'user', content: stylePrompt }],
        sampleReferencePosts(recentPostTexts),
        model,
        systemPrompt || null,
        { batchSize: TWEET_BATCH_SIZE },
      );
    } catch (e) {
      console.warn('Failed to fetch text suggestions:', e.message);
      return [];
    } finally {
      setIsLoading(false);
    }
  }

  function animateTransition(opacityVal, translateVal, direction, callback) {
    const outX = direction === 'next' ? -40 : 40;
    opacityVal.value = withTiming(0, motion.exit, (finished) => {
      if (finished) {
        runOnJS(callback)();
        translateVal.value = -outX;
        opacityVal.value = withTiming(1, SWAP_IN);
        translateVal.value = withTiming(0, SWAP_IN);
      }
    });
  }

  function navigateAsset(direction) {
    if (!hasOtherAssets) return;
    const step = direction === 'next' ? 1 : -1;
    if (direction === 'next' && findLiveIndex(assetPool, assets, currentIndex + 1, 1) <= currentIndex) {
      // Past the last one: a fresh draw.
      drawPool().then((drawn) =>
        animateTransition(mediaOpacity, mediaTranslateX, direction, () => {
          setPool(drawn);
          setAssetIndex(0);
        }),
      );
      return;
    }
    const newIndex = findLiveIndex(assetPool, assets, currentIndex + step, step);
    animateTransition(mediaOpacity, mediaTranslateX, direction, () => setAssetIndex(newIndex));
  }

  function navigateText(direction) {
    if (isLoading) return;
    if (textPool.length === 0) {
      fetchTextBatch().then(setTextPool); // the first batch failed: retry
      return;
    }
    if (direction === 'next' && textIndex === textPool.length - 1) {
      // Past the last caption: append the next batch and move to its first caption.
      const firstNewIndex = textPool.length;
      fetchTextBatch().then((newTweets) => {
        if (newTweets.length === 0) return;
        setTextPool((prev) => [...prev, ...newTweets]);
        animateTransition(textOpacity, textTranslateX, 'next', () => setTextIndex(firstNewIndex));
      });
      return;
    }
    if (textPool.length <= 1) return;
    const newIndex = direction === 'next' ? textIndex + 1 : (textIndex - 1 + textPool.length) % textPool.length;
    animateTransition(textOpacity, textTranslateX, direction, () => setTextIndex(newIndex));
  }

  // Just this asset, not its neighbours: the screen is for a look at the suggestion's albums and posts.
  function handleOpenAsset() {
    navigation.push('AssetScreen', { assetId: currentAsset.id, query: { scope: { assetId: currentAsset.id } } });
  }

  function handleConfirm() {
    finishRandomSuggestions(callerKey, { asset: currentAsset, text: currentText });
    close();
  }

  // Once only: a second tap while the sheet closes would close the screen below it too.
  function close() {
    if (isClosing) return;
    setIsClosing(true);
    navigation.goBack();
  }

  function handlePressAll() {
    setShowImages(true);
    setShowVideos(true);
  }

  function handlePressImages() {
    setShowImages(true);
    setShowVideos(false);
  }

  function handlePressVideos() {
    setShowImages(false);
    setShowVideos(true);
  }

  return (
    <ModalSheet style={styles.containerPadding}>
      <ModalHeader
        leftSlot={<ModalCloseButton onPress={close} />}
        centerSlot="Suggestions"
        rightSlot={
          <>
            <IconMenuButton accessibilityLabel="Suggestions options">
              <MenuOption label={selectedModel} icon="cpu" onPress={() => modelPickerRef.current?.open()} />
              <MenuOption label="Edit Prompt" icon="pencil" onPress={openEditPrompt} />
            </IconMenuButton>
            <PrimaryButton
              size="compact"
              label="Use"
              onPress={handleConfirm}
              disabled={(!currentAsset && !currentText) || isClosing}
            />
          </>
        }
      />

      {/* Filter bar */}
      <View style={styles.filterBar}>
        <FilterPill label="All" active={allTypesActive} onPress={handlePressAll} />
        <FilterPill label="Photos" active={showImages && !showVideos} onPress={handlePressImages} />
        <FilterPill label="Videos" active={!showImages && showVideos} onPress={handlePressVideos} />
        <FilterPill label="Favorites" active={onlyFavorites} onPress={() => setOnlyFavorites((v) => !v)} />
      </View>

      {/* Media card */}
      <Card style={styles.mediaCard} {...mediaPanHandlers}>
        <Animated.View style={[StyleSheet.absoluteFill, mediaAnimStyle]}>
          {currentAsset ? (
            <SuperPressable
              style={StyleSheet.absoluteFill}
              onPress={handleOpenAsset}
              accessibilityRole="button"
              accessibilityLabel="Show details"
            >
              <AssetImage asset={currentAsset} contentFit="contain" placeholderColor="transparent" />
              {currentAsset.mediaType === MEDIA_TYPES.VIDEO && (
                <View style={styles.videoBadge}>
                  <Icon name="video" size={scale(11)} color={colors.textInverse} />
                  {!!currentAsset.duration && (
                    <Text style={styles.videoBadgeText}>{formatVideoDuration(currentAsset.duration)}</Text>
                  )}
                </View>
              )}
            </SuperPressable>
          ) : (
            <EmptyState icon="images" title="No media matches these filters" style={{ flex: 1 }} />
          )}
        </Animated.View>

        {hasOtherAssets && (
          <>
            <TouchableOpacity
              style={[styles.arrowButton, styles.arrowLeft]}
              onPress={() => navigateAsset('prev')}
              hitSlop={8}
            >
              <Icon name="chevron-left" size={scale(18)} color={colors.text} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.arrowButton, styles.arrowRight]}
              onPress={() => navigateAsset('next')}
              hitSlop={8}
            >
              <Icon name="chevron-right" size={scale(18)} color={colors.text} />
            </TouchableOpacity>
          </>
        )}
      </Card>

      {currentAsset && (
        <LastPosted assetId={currentAsset.id} onPress={handleOpenAsset} style={[styles.lastPosted, mediaAnimStyle]} />
      )}

      {/* Caption card */}
      <Card style={styles.captionCard} {...textPanHandlers}>
        {textPool.length > 1 && (
          <IconButton
            icon="chevron-left"
            size={scale(20)}
            color={colors.textSecondary}
            onPress={() => navigateText('prev')}
            accessibilityLabel="Previous suggestion"
          />
        )}
        <Animated.View style={[styles.captionContent, textAnimStyle]}>
          {isLoading ? (
            <ActivityIndicator size="small" color={colors.textTertiary} style={styles.captionSpinner} />
          ) : (
            // Read-only: "Use" opens the post editor, where the caption can be edited.
            <Text style={[styles.captionText, !currentText && styles.captionPlaceholder]}>
              {currentText ?? 'No captions yet. Swipe to try again.'}
            </Text>
          )}
        </Animated.View>
        {textPool.length > 1 && (
          <IconButton
            icon="chevron-right"
            size={scale(20)}
            color={colors.textSecondary}
            onPress={() => navigateText('next')}
            accessibilityLabel="Next suggestion"
          />
        )}
      </Card>

      {/* Hidden model picker — trigger is invisible, the picker Modal still works */}
      <View style={styles.hidden}>
        <ModelSelectorButton ref={modelPickerRef} onChange={setSelectedModel} />
      </View>

      {/* Edit Prompt modal */}
      <Modal
        visible={showEditPrompt}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowEditPrompt(false)}
        // Focus shortly after showing, not with autoFocus: on web the sheets' focus traps hand over in
        // effects after this one paints, and until then the outer sheet takes focus back.
        onShow={() => setTimeout(() => promptInputRef.current?.focus(), PROMPT_FOCUS_DELAY_MS)}
      >
        <View style={styles.promptContainer}>
          <ModalHeader
            leftSlot={<ModalCloseButton onPress={() => setShowEditPrompt(false)} />}
            centerSlot="Edit Prompt"
            rightSlot={<PrimaryButton size="compact" label="Save" onPress={handleSavePrompt} />}
          />
          <Card style={styles.promptInputCard}>
            <Textarea
              value={editablePrompt}
              onChangeText={setEditablePrompt}
              placeholder="Describe the style of posts to generate…"
              ref={promptInputRef}
              style={styles.promptInput}
            />
          </Card>
        </View>
      </Modal>
    </ModalSheet>
  );
}

function FilterPill({ label, active, onPress }) {
  return (
    <TouchableOpacity
      style={[styles.filterPill, active && styles.filterPillActive]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <Text style={[styles.filterPillText, active && styles.filterPillTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

// When the asset and its album were last posted, opening the asset's screen on a press.
function LastPosted({ assetId, onPress, style }) {
  const lastPosted = useLiveQuery((db) => readLastPosted(db, assetId), lastPostedTables, [assetId], {
    minInterval: MIN_REREAD_INTERVAL,
  });

  if (!lastPosted) return null;

  return (
    <Animated.View style={style}>
      <ThumbnailRow {...lastPostedText(lastPosted)} hasThumbnail={false} isLast onPress={onPress} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  containerPadding: {
    paddingHorizontal: SCREEN_PADDING,
    paddingTop: MODAL_HEADER_HEIGHT,
  },

  // --- Filter bar ---
  filterBar: {
    flexDirection: 'row',
    gap: 8,
    paddingTop: SCREEN_PADDING,
    paddingBottom: 16,
  },
  filterPill: {
    paddingHorizontal: scale(16),
    paddingVertical: scale(10),
    borderRadius: radii.pill,
    backgroundColor: colors.glassSurface,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  filterPillActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  filterPillText: {
    fontSize: scale(15),
    fontWeight: '500',
    color: colors.text,
  },
  filterPillTextActive: {
    color: colors.textInverse,
  },

  // --- Media card ---
  mediaCard: {
    width: '100%',
    aspectRatio: 1,
  },
  arrowButton: {
    position: 'absolute',
    top: '50%',
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -18,
  },
  arrowLeft: {
    left: 10,
  },
  arrowRight: {
    right: 10,
  },
  videoBadge: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.overlayDark,
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  videoBadgeText: {
    color: colors.textInverse,
    fontSize: scale(11),
    fontWeight: '600',
  },

  // --- Last posted ---
  lastPosted: {
    marginTop: 12,
  },

  hidden: {
    position: 'absolute',
    width: 0,
    height: 0,
    overflow: 'hidden',
  },

  // --- Header right ---

  // --- Caption card ---
  captionCard: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 180,
  },
  captionContent: {
    flex: 1,
    paddingVertical: 14,
  },
  captionText: {
    fontSize: typography.input,
    color: colors.text,
  },
  captionPlaceholder: {
    color: colors.textTertiary,
  },
  captionSpinner: {
    flex: 1,
    alignSelf: 'center',
  },

  // --- Edit prompt modal ---
  promptContainer: {
    flex: 1,
    backgroundColor: colors.appBackground[0],
  },
  promptInputCard: {
    flex: 1,
    margin: SCREEN_PADDING,
    marginTop: MODAL_HEADER_HEIGHT + 8,
  },
  promptInput: {
    flex: 1,
    padding: SCREEN_PADDING,
  },
});

// The index of the first live asset in `pool` from `start`, walking by `step` and wrapping around; -1
// when none is left.
function findLiveIndex(pool, assets, start, step) {
  for (let i = 0; i < pool.length; i++) {
    const index = (((start + i * step) % pool.length) + pool.length) % pool.length;
    const asset = assets.get(pool[index]);
    if (asset && !asset.deletedAt) return index;
  }
  return -1;
}

// The asset filter keys for the pool: images or videos by media type (All: neither), plus favorites.
function poolFilter({ showImages, showVideos, onlyFavorites }) {
  const filter = [];
  if (showImages && !showVideos) filter.push('images');
  if (showVideos && !showImages) filter.push('videos');
  if (onlyFavorites) filter.push('favorites');
  return filter;
}
