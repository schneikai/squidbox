import { useState, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useSharedValue, useAnimatedScrollHandler } from 'react-native-reanimated';

import Card from '@/components/Card';
import ModalSheet from '@/components/ModalSheet';
import DateTimePicker from '@/components/DateTimePicker';
import GradientPillButton from '@/components/GradientPillButton';
import IconButton from '@/components/IconButton';
import ModalCloseButton from '@/components/ModalCloseButton';
import ModalHeader, { MODAL_HEADER_HEIGHT } from '@/components/ModalHeader';
import Textarea from '@/components/Textarea';
import PostAssetsEditor from '@/features/post-assets-editor/PostAssetsEditor';
import AiChatModal from '@/features/ai-suggestions/AiChatModal';
import RandomSuggestionsModal from '@/features/post-random-suggestions/RandomSuggestionsModal';
import usePosts from '@/features/posts-context/usePosts';
import getNewItemId from '@/utils/getNewItemId';
import { SCREEN_PADDING } from '@/constants';
import { colors } from '@/styles/designTokens';

export default function PostEditor({ post, onChange, navigation, onSave, canSave, title = 'Post' }) {
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => { scrollY.value = e.contentOffset.y; });
  const [text, setText] = useState(post.text);
  const [assetRefs, setAssetRefs] = useState(post.assetRefs);
  const [postedAt, setPostedAt] = useState(post.postedAt);
  const [showAiChat, setShowAiChat] = useState(false);
  const [showRandomSuggestions, setShowRandomSuggestions] = useState(false);

  const { posts } = usePosts();

  const recentPostTexts = useMemo(
    () =>
      Object.values(posts ?? {})
        .filter((p) => p.text?.trim())
        .sort((a, b) => b.createdAt - a.createdAt)
        .map((p) => p.text.trim()),
    [posts],
  );

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

  function handleSuggestionConfirm(asset, suggestionText) {
    // Apply both changes in a single onChange so the second update doesn't
    // overwrite the first with a stale value from this render's closure.
    const newAssetRefs = asset ? [{ id: getNewItemId(), assetId: asset.id }] : assetRefs;
    const newText = suggestionText || text;
    setAssetRefs(newAssetRefs);
    setText(newText);
    onChange({ text: newText, assetRefs: newAssetRefs, postedAt });
  }

  return (
    <ModalSheet>
      <ModalHeader
        leftSlot={navigation ? <ModalCloseButton onPress={() => navigation.goBack()} /> : null}
        scrollY={scrollY}
        rightSlot={
          <>
            <IconButton
              icon="sparkles"
              onPress={() => setShowRandomSuggestions(true)}
              accessibilityLabel="AI suggestions"
            />
            {onSave && (
              <GradientPillButton
                label="Save"
                onPress={onSave}
                disabled={!canSave}
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
        <Card style={styles.mediaCard}>
          <PostAssetsEditor
            assetRefs={assetRefs}
            onChange={handleAssetRefsChange}
          />
        </Card>

        <Card style={styles.textCard}>
          <Textarea
            placeholder="What's new?"
            numberOfLines={4}
            onChangeText={handleTextChange}
            value={text}
            style={styles.textArea}
          />
          <View style={styles.inputButtons}>
            <IconButton
              icon="wand"
              onPress={() => setShowAiChat(true)}
              color={colors.accent}
              accessibilityLabel="AI caption suggestions"
            />
          </View>
        </Card>

        <DateTimePicker timestamp={postedAt} onChange={handlePostedAtChange} />
      </Animated.ScrollView>

      <AiChatModal
        visible={showAiChat}
        onClose={() => setShowAiChat(false)}
        onSelect={(suggestion) => handleTextChange(suggestion)}
        recentPostTexts={recentPostTexts}
        existingText={text}
      />

      <RandomSuggestionsModal
        visible={showRandomSuggestions}
        onClose={() => setShowRandomSuggestions(false)}
        onConfirm={handleSuggestionConfirm}
        recentPostTexts={recentPostTexts}
      />
    </ModalSheet>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingTop: MODAL_HEADER_HEIGHT + SCREEN_PADDING,
    paddingHorizontal: SCREEN_PADDING,
    paddingBottom: SCREEN_PADDING * 2,
    gap: 12,
  },

  mediaCard: {
    overflow: 'hidden',
  },

  textCard: {
    paddingTop: SCREEN_PADDING,
    paddingHorizontal: SCREEN_PADDING,
    paddingBottom: SCREEN_PADDING,
  },

  textArea: {
    lineHeight: 26,
    paddingRight: 56,
    minHeight: 100,
  },

  inputButtons: {
    position: 'absolute',
    right: SCREEN_PADDING,
    top: SCREEN_PADDING,
    flexDirection: 'row',
    gap: 8,
  },
});
