import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useSharedValue, useAnimatedScrollHandler } from 'react-native-reanimated';

import Card from '@/components/Card';
import DateTimePicker from '@/components/DateTimePicker';
import GradientPillButton from '@/components/GradientPillButton';
import IconButton from '@/components/IconButton';
import ModalCloseButton from '@/components/ModalCloseButton';
import ModalHeader, { MODAL_HEADER_HEIGHT } from '@/components/ModalHeader';
import ModalSheet from '@/components/ModalSheet';
import Textarea from '@/components/Textarea';
import { SCREEN_PADDING } from '@/constants';
import AiChatModal from '@/features/ai-suggestions/AiChatModal';
import PostAssetsEditor from '@/features/post-assets-editor/PostAssetsEditor';
import RandomSuggestionsModal from '@/features/post-random-suggestions/RandomSuggestionsModal';
import { colors } from '@/styles/designTokens';
import { schema } from '@/sync/db/client';
import { readPostTexts } from '@/sync/postsRepository';
import { useLiveQuery } from '@/sync/useLiveQuery';
import buildPostAsset from '@/utils/posts/buildPostAsset';
import postAssetsToAssetRefs from '@/utils/posts/postAssetsToAssetRefs';

const NO_TEXTS = [];

// Edits a post seeded from `post` ({ text, postAssets, postedAt }); every change is reported as
// { text, assetRefs, postedAt }, what the posts store takes.
export default function PostEditor({ post, onChange, navigation, onSave, canSave, title = 'Post' }) {
  const scrollY = useSharedValue(0);
  const [isSaving, setIsSaving] = useState(false);
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });
  const [text, setText] = useState(post.text);
  const [postAssets, setPostAssets] = useState(post.postAssets);
  const [postedAt, setPostedAt] = useState(post.postedAt);
  const [showAiChat, setShowAiChat] = useState(false);
  const [showRandomSuggestions, setShowRandomSuggestions] = useState(false);
  const recentPostTexts = useLiveQuery(readPostTexts, [schema.posts]) ?? NO_TEXTS;

  function emit(changes) {
    const next = { text, postAssets, postedAt, ...changes };
    onChange({ text: next.text, assetRefs: postAssetsToAssetRefs(next.postAssets), postedAt: next.postedAt });
  }

  function handleTextChange(newText) {
    setText(newText);
    emit({ text: newText });
  }

  function handlePostAssetsChange(newPostAssets) {
    setPostAssets(newPostAssets);
    emit({ postAssets: newPostAssets });
  }

  function handlePostedAtChange(newPostedAt) {
    setPostedAt(newPostedAt);
    emit({ postedAt: newPostedAt });
  }

  function handleSuggestionConfirm(asset, suggestionText) {
    // Apply both changes in a single onChange so the second update doesn't
    // overwrite the first with a stale value from this render's closure.
    const newPostAssets = asset ? [buildPostAsset(asset)] : postAssets;
    const newText = suggestionText || text;
    setPostAssets(newPostAssets);
    setText(newText);
    emit({ text: newText, postAssets: newPostAssets });
  }

  // One save at a time: a second tap while the first is still writing would save the post twice.
  async function handleSave() {
    setIsSaving(true);
    try {
      await onSave();
    } finally {
      setIsSaving(false);
    }
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
            {onSave && <GradientPillButton label="Save" onPress={handleSave} disabled={!canSave || isSaving} />}
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
          <PostAssetsEditor postAssets={postAssets} onChange={handlePostAssetsChange} />
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
