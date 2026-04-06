import { useState, useMemo, useRef, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  PanResponder,
  ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, runOnJS } from 'react-native-reanimated';
import Icon from '@/components/Icon';
import { MenuProvider } from 'react-native-popup-menu';

import AssetImage from '@/components/AssetImage';
import ModalSheet from '@/components/ModalSheet';
import Card from '@/components/Card';
import IconButton from '@/components/IconButton';
import EmptyState from '@/components/EmptyState';
import GradientPillButton from '@/components/GradientPillButton';
import IconMenuButton from '@/components/IconMenuButton';
import ModalCloseButton from '@/components/ModalCloseButton';
import ModalHeader, { MODAL_HEADER_HEIGHT } from '@/components/ModalHeader';
import Textarea from '@/components/Textarea';
import useAssets from '@/features/assets-context/useAssets';
import ModelSelectorButton from '@/features/ai-suggestions/ModelSelectorButton';
import MenuOption from '@/components/popup-menu-options/MenuOption';
import sendAiMessageAsync from '@/features/ai-suggestions/sendAiMessageAsync';
import {
  DEFAULT_MODEL,
  DEFAULT_RANDOM_TWEETS_PROMPT,
  MODEL_STORAGE_KEY,
  RANDOM_TWEETS_PROMPT_STORAGE_KEY,
  SYSTEM_PROMPT_STORAGE_KEY,
  DEFAULT_SYSTEM_PROMPT,
} from '@/features/ai-suggestions/aiSuggestionsStorage';
import formatVideoDuration from '@/utils/formatVideoDuration';
import { colors, radii, scale } from '@/styles/designTokens';
import { SCREEN_PADDING } from '@/constants';

const TWEET_BATCH_SIZE = 10;
const BATCH_INSTRUCTION = `Generate exactly ${TWEET_BATCH_SIZE} tweets and return them as a raw JSON array of strings. Nothing else.`;
const SWIPE_THRESHOLD = 50;

export default function RandomSuggestionsModal({ visible, onClose, onConfirm, recentPostTexts = [] }) {
  const { assets } = useAssets();

  // --- Ellipsis menu ---
  const modelPickerRef = useRef(null);
  const [selectedModel, setSelectedModel] = useState(DEFAULT_MODEL);

  // --- Prompt editor ---
  const [showEditPrompt, setShowEditPrompt] = useState(false);
  const [editablePrompt, setEditablePrompt] = useState('');

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
    fetchTextBatch();
  }

  // --- Filter state (type: exclusive All/Images/Videos; favorites: additive) ---
  const [showImages, setShowImages] = useState(true);
  const [showVideos, setShowVideos] = useState(true);
  const [onlyFavorites, setOnlyFavorites] = useState(false);

  // --- Asset pool ---
  const assetPool = useMemo(() => {
    let pool = Object.values(assets ?? {}).filter((a) => !a.isDeleted);
    if (onlyFavorites) pool = pool.filter((a) => a.isFavorite);
    const typed = pool.filter((a) => {
      const isVideo = !!a.duration;
      return (showImages && !isVideo) || (showVideos && isVideo);
    });
    return [...typed].sort(() => Math.random() - 0.5);
  }, [assets, showImages, showVideos, onlyFavorites]);

  const [assetIndex, setAssetIndex] = useState(0);

  useEffect(() => {
    setAssetIndex(0);
  }, [assetPool]);

  // --- Text pool ---
  const [textPool, setTextPool] = useState([]);
  const [textIndex, setTextIndex] = useState(0);
  const [editableText, setEditableText] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (visible && textPool.length === 0) {
      fetchTextBatch();
    }
    if (visible) {
      AsyncStorage.getItem(MODEL_STORAGE_KEY).then((m) => {
        if (m) setSelectedModel(m);
      });
    }
    if (!visible) {
      setTextPool([]);
      setTextIndex(0);
    }
  }, [visible]);

  async function fetchTextBatch() {
    setIsLoading(true);
    try {
      const [storedPrompt, storedModel, storedSystemPrompt] = await Promise.all([
        AsyncStorage.getItem(RANDOM_TWEETS_PROMPT_STORAGE_KEY),
        AsyncStorage.getItem(MODEL_STORAGE_KEY),
        AsyncStorage.getItem(SYSTEM_PROMPT_STORAGE_KEY),
      ]);
      const stylePrompt = (storedPrompt ?? DEFAULT_RANDOM_TWEETS_PROMPT).trim();
      const model = storedModel ?? DEFAULT_MODEL;
      const systemPrompt = storedSystemPrompt ?? DEFAULT_SYSTEM_PROMPT;
      const fullPrompt = `${BATCH_INSTRUCTION}\n\n${stylePrompt}`;
      const tweets = await sendAiMessageAsync(
        [{ role: 'user', content: fullPrompt }],
        recentPostTexts,
        model,
        systemPrompt || null,
      );
      setTextPool(tweets);
      setTextIndex(0);
      setEditableText(tweets[0] ?? '');
      return tweets;
    } catch (e) {
      console.warn('Failed to fetch text suggestions:', e.message);
      return [];
    } finally {
      setIsLoading(false);
    }
  }

  // --- Animations ---
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

  function animateTransition(opacityVal, translateVal, direction, callback) {
    const outX = direction === 'next' ? -40 : 40;
    opacityVal.value = withTiming(0, { duration: 100 }, (finished) => {
      if (finished) {
        runOnJS(callback)();
        translateVal.value = -outX;
        opacityVal.value = withTiming(1, { duration: 150 });
        translateVal.value = withTiming(0, { duration: 150 });
      }
    });
  }

  // --- Asset navigation ---
  const currentAsset = assetPool[assetIndex] ?? null;

  function navigateAsset(direction) {
    if (assetPool.length <= 1) return;
    const newIndex =
      direction === 'next'
        ? (assetIndex + 1) % assetPool.length
        : (assetIndex - 1 + assetPool.length) % assetPool.length;
    animateTransition(mediaOpacity, mediaTranslateX, direction, () => setAssetIndex(newIndex));
  }

  // --- Text navigation ---
  const currentText = textPool[textIndex] ?? null;

  useEffect(() => {
    setEditableText(currentText ?? '');
  }, [textIndex]);

  function handleTextEdit(value) {
    setEditableText(value);
    setTextPool((prev) => {
      const updated = [...prev];
      updated[textIndex] = value;
      return updated;
    });
  }

  function navigateText(direction) {
    if (textPool.length === 0) return;
    if (direction === 'next' && textIndex === textPool.length - 1) {
      fetchTextBatch().then((newTweets) => {
        if (newTweets.length > 0) {
          setTextPool((prev) => {
            const appended = [...prev, ...newTweets];
            animateTransition(textOpacity, textTranslateX, 'next', () =>
              setTextIndex(prev.length),
            );
            return appended;
          });
        }
      });
      return;
    }
    if (textPool.length <= 1) return;
    const newIndex =
      direction === 'next'
        ? textIndex + 1
        : (textIndex - 1 + textPool.length) % textPool.length;
    animateTransition(textOpacity, textTranslateX, direction, () => setTextIndex(newIndex));
  }

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

  // --- Confirm ---
  function handleConfirm() {
    onConfirm(currentAsset, editableText || null);
    onClose();
  }

  // --- Filter helpers ---
  const allTypesActive = showImages && showVideos;

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
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <MenuProvider skipInstanceCheck>
      <ModalSheet style={styles.containerPadding}>
        <ModalHeader
          leftSlot={<ModalCloseButton onPress={onClose} />}
          centerSlot="Suggestions"
          rightSlot={
            <View style={styles.headerRight}>
              <IconMenuButton accessibilityLabel="Suggestions options">
                <MenuOption label={selectedModel} icon="cpu" onPress={() => modelPickerRef.current?.open()} />
                <MenuOption label="Edit Prompt" icon="pencil" onPress={openEditPrompt} isLast />
              </IconMenuButton>
              <GradientPillButton
                label="Use"
                onPress={handleConfirm}
                disabled={!currentAsset && !editableText}
              />
            </View>
          }
        />

        {/* Filter bar */}
        <View style={styles.filterBar}>
          <FilterPill label="All" active={allTypesActive} onPress={handlePressAll} />
          <FilterPill label="Images" active={showImages && !showVideos} onPress={handlePressImages} />
          <FilterPill label="Videos" active={!showImages && showVideos} onPress={handlePressVideos} />
          <FilterPill label="Favorites" active={onlyFavorites} onPress={() => setOnlyFavorites((v) => !v)} />
        </View>

        {/* Media card */}
        <Card style={styles.mediaCard} {...mediaPanHandlers}>
          <Animated.View style={[StyleSheet.absoluteFill, mediaAnimStyle]}>
            {currentAsset ? (
              <>
                <AssetImage asset={currentAsset} contentFit="contain" placeholderColor="transparent" />
                {currentAsset.duration ? (
                  <View style={styles.videoBadge}>
                    <Icon name="video" size={scale(11)} color={colors.textInverse} />
                    <Text style={styles.videoBadgeText}>{formatVideoDuration(currentAsset.duration)}</Text>
                  </View>
                ) : null}
              </>
            ) : (
              <EmptyState icon="images" title="No media matches these filters" style={{ flex: 1 }} />
            )}
          </Animated.View>

          {assetPool.length > 1 && (
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
              <Textarea
                value={editableText}
                onChangeText={handleTextEdit}
                placeholder="Generating captions…"
                style={styles.captionInput}
              />
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

      </ModalSheet>

      {/* Hidden model picker — trigger is invisible, the picker Modal still works */}
      <View style={styles.hidden}>
        <ModelSelectorButton ref={modelPickerRef} onChange={setSelectedModel} />
      </View>

      </MenuProvider>

      {/* Edit Prompt modal */}
      <Modal
        visible={showEditPrompt}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowEditPrompt(false)}
      >
        <View style={styles.promptContainer}>
          <ModalHeader
            leftSlot={<ModalCloseButton onPress={() => setShowEditPrompt(false)} />}
            centerSlot="Edit Prompt"
            rightSlot={<GradientPillButton label="Save" onPress={handleSavePrompt} />}
          />
          <View style={styles.promptInputCard}>
            <Textarea
              value={editablePrompt}
              onChangeText={setEditablePrompt}
              placeholder="Describe the style of posts to generate…"
              autoFocus
              style={styles.promptInput}
            />
          </View>
        </View>
      </Modal>
    </Modal>
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

  hidden: {
    position: 'absolute',
    width: 0,
    height: 0,
    overflow: 'hidden',
  },

  // --- Header right ---
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },

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
  captionInput: {
    flex: 1,
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
    backgroundColor: colors.glassSurface,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.glassBorder,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
  },
  promptInput: {
    flex: 1,
    padding: SCREEN_PADDING,
  },
});
