import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import Card from '@/components/Card';
import DateTimePicker from '@/components/DateTimePicker';
import IconButton from '@/components/IconButton';
import ModalCloseButton from '@/components/ModalCloseButton';
import ModalHeader, { MODAL_HEADER_HEIGHT } from '@/components/ModalHeader';
import ModalSheet from '@/components/ModalSheet';
import PrimaryButton from '@/components/PrimaryButton';
import Textarea from '@/components/Textarea';
import { SCREEN_PADDING } from '@/constants';
import AiChatModal from '@/features/ai-suggestions/AiChatModal';
import PostAssetsEditor from '@/features/post-assets-editor/PostAssetsEditor';
import useRandomSuggestions from '@/features/post-random-suggestions/useRandomSuggestions';
import useScrollY from '@/hooks/useScrollY';
import { colors } from '@/styles/designTokens';
import buildPostAsset from '@/utils/posts/buildPostAsset';
import postAssetsToAssetRefs from '@/utils/posts/postAssetsToAssetRefs';

// Edits a post seeded from `post` ({ text, postAssets, postedAt }) and holds the draft; Save hands
// `onSave` the post the posts store takes ({ text, assetRefs, postedAt }), allowed once it is valid,
// and the seed in the same shape, so an edit can save only what changed.
export default function PostEditor({ post, navigation, onSave }) {
  const { scrollY, onScroll } = useScrollY();
  const [isSaving, setIsSaving] = useState(false);
  const [text, setText] = useState(post.text);
  const [postAssets, setPostAssets] = useState(post.postAssets);
  const [postedAt, setPostedAt] = useState(post.postedAt);
  const [showAiChat, setShowAiChat] = useState(false);
  const { openRandomSuggestions } = useRandomSuggestions();

  const data = postData({ text, postAssets, postedAt });
  const canSave = hasContent(data);

  async function handleOpenSuggestions() {
    const suggestion = await openRandomSuggestions();
    if (suggestion?.asset) setPostAssets([buildPostAsset(suggestion.asset)]);
    if (suggestion?.text) setText(suggestion.text);
  }

  // One save at a time: a second tap while the first is still writing would save the post twice.
  async function handleSave() {
    setIsSaving(true);
    try {
      await onSave(data, postData(post));
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
            <IconButton icon="sparkles" onPress={handleOpenSuggestions} accessibilityLabel="AI suggestions" />
            {onSave && (
              <PrimaryButton size="compact" label="Save" onPress={handleSave} disabled={!canSave || isSaving} />
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
    </ModalSheet>
  );
}

// The post as the posts store takes it.
function postData({ text, postAssets, postedAt }) {
  return { text, assetRefs: postAssetsToAssetRefs(postAssets), postedAt };
}

// A post needs text or at least one photo.
function hasContent({ text, assetRefs }) {
  return Boolean(text) || assetRefs.length > 0;
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
