import { useState, useMemo, useRef, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  PanResponder,
  ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, runOnJS } from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import AssetImage from '@/components/AssetImage';
import GradientPillButton from '@/components/GradientPillButton';
import ModalCloseButton from '@/components/ModalCloseButton';
import ModalHeader, { MODAL_HEADER_HEIGHT } from '@/components/ModalHeader';
import useAssets from '@/features/assets-context/useAssets';
import ModelSelectorButton from '@/features/ai-suggestions/ModelSelectorButton';
import MenuOption from '@/components/popup-menu-options/MenuOption';
import { Menu, MenuOptions, MenuProvider, MenuTrigger } from 'react-native-popup-menu';
import actionButtonStyles, { menuTriggerTouchable } from '@/styles/actionButtonStyles';
import popupMenuStyles from '@/styles/popupMenuStyles';
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
import { colors, glass, radii, scale, typography } from '@/styles/designTokens';
import { SCREEN_PADDING } from '@/constants';

const TWEET_BATCH_SIZE = 10;
const BATCH_INSTRUCTION = `Generate exactly ${TWEET_BATCH_SIZE} tweets and return them as a raw JSON array of strings. Nothing else.`;
const SWIPE_THRESHOLD = 50;

export default function RandomSuggestionsModal({ visible, onClose, onConfirm, recentPostTexts = [] }) {
  const { assets } = useAssets();

  // --- Ellipsis menu ---
  const ellipsisMenuRef = useRef(null);
  const [ellipsisMenuOpen, setEllipsisMenuOpen] = useState(false);
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
      // Reached the end — fetch more and append
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
      <View style={styles.container}>
        <ModalHeader
          leftSlot={<ModalCloseButton onPress={onClose} />}
          centerSlot="Suggestions"
          rightSlot={
            <View style={styles.headerRight}>
              
              <Menu
                ref={ellipsisMenuRef}
                onOpen={() => setEllipsisMenuOpen(true)}
                onClose={() => setEllipsisMenuOpen(false)}
              >
                <MenuTrigger
                  disabled
                  customStyles={{ triggerWrapper: actionButtonStyles.pillButton }}
                >
                  <TouchableOpacity
                    onPress={() => ellipsisMenuOpen
                      ? ellipsisMenuRef.current?.close()
                      : ellipsisMenuRef.current?.open()
                    }
                    style={styles.ellipsisTrigger}
                    hitSlop={8}
                  >
                    <Ionicons name="ellipsis-horizontal" style={actionButtonStyles.buttonIcon} />
                  </TouchableOpacity>
                </MenuTrigger>
                <MenuOptions customStyles={popupMenuStyles.menuOptions}>
                  <MenuOption label={selectedModel} icon="hardware-chip-outline" onPress={() => modelPickerRef.current?.open()} />
                  <MenuOption label="Edit Prompt" icon="pencil-outline" onPress={openEditPrompt} isLast />
                </MenuOptions>
              </Menu>
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
        <View style={styles.mediaCard} {...mediaPanHandlers}>
          <Animated.View style={[StyleSheet.absoluteFill, mediaAnimStyle]}>
            {currentAsset ? (
              <>
                <AssetImage asset={currentAsset} contentFit="contain" placeholderColor="transparent" />
                {currentAsset.duration ? (
                  <View style={styles.videoBadge}>
                    <Ionicons name="videocam" size={scale(11)} color={colors.textInverse} />
                    <Text style={styles.videoBadgeText}>{formatVideoDuration(currentAsset.duration)}</Text>
                  </View>
                ) : null}
              </>
            ) : (
              <View style={styles.emptyMedia}>
                <Ionicons name="images-outline" size={scale(48)} color={colors.textTertiary} />
                <Text style={styles.emptyText}>No media matches these filters</Text>
              </View>
            )}
          </Animated.View>

          {assetPool.length > 1 && (
            <>
              <TouchableOpacity
                style={[styles.arrowButton, styles.arrowLeft]}
                onPress={() => navigateAsset('prev')}
                hitSlop={8}
              >
                <Ionicons name="chevron-back" size={scale(18)} color={colors.text} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.arrowButton, styles.arrowRight]}
                onPress={() => navigateAsset('next')}
                hitSlop={8}
              >
                <Ionicons name="chevron-forward" size={scale(18)} color={colors.text} />
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Caption card */}
        <View style={styles.captionCard} {...textPanHandlers}>
          {textPool.length > 1 && (
            <TouchableOpacity style={styles.captionArrowBtn} onPress={() => navigateText('prev')} hitSlop={8}>
              <Ionicons name="chevron-back" size={scale(20)} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
          <Animated.View style={[styles.captionContent, textAnimStyle]}>
            {isLoading ? (
              <ActivityIndicator size="small" color={colors.textTertiary} style={styles.captionSpinner} />
            ) : (
              <TextInput
                style={styles.captionInput}
                value={editableText}
                onChangeText={handleTextEdit}
                placeholder="Generating captions…"
                placeholderTextColor={colors.textTertiary}
                multiline
                textAlignVertical="top"
              />
            )}
          </Animated.View>
          {textPool.length > 1 && (
            <TouchableOpacity style={styles.captionArrowBtn} onPress={() => navigateText('next')} hitSlop={8}>
              <Ionicons name="chevron-forward" size={scale(20)} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>

      </View>

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
            <TextInput
              style={styles.promptInput}
              value={editablePrompt}
              onChangeText={setEditablePrompt}
              placeholder="Describe the style of posts to generate…"
              placeholderTextColor={colors.textTertiary}
              multiline
              autoFocus
              textAlignVertical="top"
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
  container: {
    flex: 1,
    backgroundColor: colors.appBackground[0],
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
    ...glass,
    width: '100%',
    aspectRatio: 1,
    borderRadius: radii.card,
    overflow: 'hidden',
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
  emptyMedia: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  emptyText: {
    fontSize: typography.sm,
    color: colors.textTertiary,
    textAlign: 'center',
    paddingHorizontal: 24,
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
  ellipsisTrigger: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // --- Caption card ---
  captionCard: {
    ...glass,
    borderRadius: radii.card,
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'stretch',
    minHeight: 180,
  },
  captionArrowBtn: {
    paddingHorizontal: SCREEN_PADDING,
    alignItems: 'center',
    justifyContent: 'center',
  },
  captionContent: {
    flex: 1,
    paddingVertical: 14,
  },
  captionInput: {
    flex: 1,
    fontSize: typography.input,
    color: colors.text,
    lineHeight: 24,
    textAlignVertical: 'top',
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
    fontSize: typography.input,
    lineHeight: 24,
    color: colors.text,
    padding: SCREEN_PADDING,
    textAlignVertical: 'top',
  },

});
