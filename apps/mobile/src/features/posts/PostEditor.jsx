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
import buildPostAsset from '@/utils/posts/buildPostAsset';
import postAssetsToAssetRefs from '@/utils/posts/postAssetsToAssetRefs';
import postSchema from '@/utils/posts/postSchema';

// Edits a post seeded from `post` ({ text, postAssets, postedAt }) and holds the draft; Save hands
// `onSave` the post the posts store takes ({ text, assetRefs, postedAt }), allowed once it is valid.
export default function PostEditor({ post, navigation, onSave }) {
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

  const data = { text, assetRefs: postAssetsToAssetRefs(postAssets), postedAt };
  const canSave = postSchema.isValidSync(data);

  function handleSuggestionConfirm(asset, suggestionText) {
    if (asset) setPostAssets([buildPostAsset(asset)]);
    if (suggestionText) setText(suggestionText);
  }

  // One save at a time: a second tap while the first is still writing would save the post twice.
  async function handleSave() {
    setIsSaving(true);
    try {
      await onSave(data);
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
          <PostAssetsEditor postAssets={postAssets} onChange={setPostAssets} />
        </Card>

        <Card style={styles.textCard}>
          <Textarea
            placeholder="What's new?"
            numberOfLines={4}
            onChangeText={setText}
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

        <DateTimePicker timestamp={postedAt} onChange={setPostedAt} />
      </Animated.ScrollView>

      <AiChatModal visible={showAiChat} onClose={() => setShowAiChat(false)} onSelect={setText} existingText={text} />

      <RandomSuggestionsModal
        visible={showRandomSuggestions}
        onClose={() => setShowRandomSuggestions(false)}
        onConfirm={handleSuggestionConfirm}
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
