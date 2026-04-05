import { useState, useMemo, useRef } from 'react';
import { ActivityIndicator, StyleSheet, View, TextInput, TouchableOpacity } from 'react-native';
import Animated, { useSharedValue, useAnimatedScrollHandler } from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';

import DateTimePicker from '@/components/DateTimePicker';
import GradientPillButton from '@/components/GradientPillButton';
import ModalCloseButton from '@/components/ModalCloseButton';
import ModalHeader, { MODAL_HEADER_HEIGHT } from '@/components/ModalHeader';
import PostAssetsEditor from '@/features/post-assets-editor/PostAssetsEditor';
import AiChatModal from '@/features/ai-suggestions/AiChatModal';
import useRandomSuggestions from '@/features/post-random-suggestions/useRandomSuggestions';
import usePosts from '@/features/posts-context/usePosts';
import { REFERENCE_POST_COUNT } from '@/features/ai-suggestions/sendAiMessageAsync';
import { SCREEN_PADDING } from '@/constants';
import { colors, glass, radii, spacing, typography } from '@/styles/designTokens';

export default function PostEditor({ post, onChange, navigation, onSave, canSave, title = 'Post' }) {
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => { scrollY.value = e.contentOffset.y; });
  const [text, setText] = useState(post.text);
  const [assetRefs, setAssetRefs] = useState(post.assetRefs);
  const [postedAt, setPostedAt] = useState(post.postedAt);
  const [showAiChat, setShowAiChat] = useState(false);

  const { posts } = usePosts();

  const recentPostTexts = useMemo(
    () =>
      Object.values(posts ?? {})
        .filter((p) => p.text?.trim())
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, REFERENCE_POST_COUNT)
        .map((p) => p.text.trim()),
    [posts],
  );

  const { getNextTweet, getNextAsset, isLoading } = useRandomSuggestions({ recentPostTexts });
  const randomizeAssetRef = useRef(null);

  function handleTextChange(newText) {
    setText(newText);
    onChange({ text: newText, assetRefs, postedAt });
  }

  function handleAssetRefsChange(newAssetRefs) {
    setAssetRefs(newAssetRefs);
    onChange({ text, assetRefs: newAssetRefs, postedAt });
  }

  function handlePostedAtChange(newPostedAt) {
    setPostedAt(newPostedAt);
    onChange({ text, assetRefs, postedAt: newPostedAt });
  }

  async function handleShuffleBoth() {
    try {
      const tweet = await getNextTweet();
      if (tweet) handleTextChange(tweet);
      randomizeAssetRef.current?.();
    } catch (e) {
      console.warn('Random suggestion failed:', e.message);
    }
  }

  async function handleRandomizeTweet() {
    try {
      const tweet = await getNextTweet();
      if (tweet) handleTextChange(tweet);
    } catch (e) {
      console.warn('Random tweet failed:', e.message);
    }
  }

  return (
    <View style={styles.container}>
      <ModalHeader
        leftSlot={navigation ? <ModalCloseButton onPress={() => navigation.goBack()} /> : null}
        scrollY={scrollY}
        rightSlot={
          <>
            <TouchableOpacity
              onPress={handleShuffleBoth}
              disabled={isLoading}
              style={styles.dicePillButton}
              hitSlop={8}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color={colors.accent} />
              ) : (
                <Ionicons name="dice-outline" size={spacing.iconSize} color={colors.text} />
              )}
            </TouchableOpacity>
            {onSave && (
              <GradientPillButton
                label="Save"
                onPress={onSave}
                disabled={!canSave || isLoading}
              />
            )}
          </>
        }
      />
      <Animated.ScrollView
        automaticallyAdjustKeyboardInsets
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={styles.scrollContent}
      >
        <View>
          <View style={[styles.card, styles.mediaCard]}>
            <PostAssetsEditor
              assetRefs={assetRefs}
              onChange={handleAssetRefsChange}
              getRandomAsset={getNextAsset}
              randomizeRef={randomizeAssetRef}
            />
          </View>
          <TouchableOpacity
            style={styles.mediaDiceButton}
            onPress={() => randomizeAssetRef.current?.()}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="dice-outline" size={22} color={colors.textInverse} />
          </TouchableOpacity>
        </View>

        <View style={[styles.card, styles.textCard]}>
          <TextInput
            style={styles.textArea}
            placeholder="What's new?"
            placeholderTextColor={colors.textTertiary}
            multiline
            numberOfLines={4}
            onChangeText={handleTextChange}
            value={text}
          />
          <View style={styles.inputButtons}>
            <TouchableOpacity
              onPress={handleRandomizeTweet}
              disabled={isLoading}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color={colors.accent} />
              ) : (
                <Ionicons name="dice-outline" size={spacing.iconSize} color={colors.accent} />
              )}
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setShowAiChat(true)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="color-wand-outline" size={spacing.iconSize} color={colors.accent} />
            </TouchableOpacity>
          </View>
        </View>

        <DateTimePicker timestamp={postedAt} onChange={handlePostedAtChange} />
      </Animated.ScrollView>

      <AiChatModal
        visible={showAiChat}
        onClose={() => setShowAiChat(false)}
        onSelect={(suggestion) => handleTextChange(suggestion)}
        recentPostTexts={recentPostTexts}
        existingText={text}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.appBackground[0],
  },

  scrollContent: {
    paddingTop: MODAL_HEADER_HEIGHT + SCREEN_PADDING,
    paddingHorizontal: SCREEN_PADDING,
    paddingBottom: SCREEN_PADDING * 2,
    gap: 12,
  },

  card: {
    ...glass,
    borderRadius: radii.card,
  },

  mediaCard: {
    overflow: 'hidden',
  },

  mediaDiceButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: colors.overlayDark,
    borderRadius: 16,
    padding: 5,
  },

  textCard: {
    paddingTop: SCREEN_PADDING,
    paddingHorizontal: SCREEN_PADDING,
    paddingBottom: SCREEN_PADDING,
  },

  textArea: {
    fontSize: typography.input,
    lineHeight: 26,
    color: colors.text,
    paddingRight: 56,
    minHeight: 100,
    textAlignVertical: 'top',
  },

  inputButtons: {
    position: 'absolute',
    right: SCREEN_PADDING,
    top: SCREEN_PADDING,
    flexDirection: 'row',
    gap: 8,
  },

  dicePillButton: {
    width: spacing.iconButtonSize,
    height: spacing.iconButtonSize,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
