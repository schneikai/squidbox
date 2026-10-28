import { useState } from 'react';
import { StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';

import Card from '@/components/Card';
import DateTimePicker from '@/components/DateTimePicker';
import ModalCloseButton from '@/components/ModalCloseButton';
import ModalHeader, { MODAL_HEADER_HEIGHT } from '@/components/ModalHeader';
import ModalSheet from '@/components/ModalSheet';
import PrimaryButton from '@/components/PrimaryButton';
import Textarea from '@/components/Textarea';
import { SCREEN_PADDING } from '@/constants';
import PostAssetsEditor from '@/features/post-assets-editor/PostAssetsEditor';
import WriteWithAi from '@/features/post-chat/WriteWithAi';
import useEditorChat from '@/features/post-chat/useEditorChat';
import useScrollY from '@/hooks/useScrollY';
import postAssetsToAssetRefs from '@/utils/posts/postAssetsToAssetRefs';

// Edits a post seeded from `post` ({ text, postAssets, postedAt }) and holds the draft; Save hands
// `onSave` the post the posts store takes ({ text, assetRefs, postedAt }), allowed once it is valid,
// and the seed in the same shape, so an edit can save only what changed. `kind` is what its
// assistant chat is about (chatSubjectKindSchema: 'draft' a new post, 'edit' a saved one).
export default function PostEditor({ kind, post, navigation, onSave }) {
  const { scrollY, onScroll } = useScrollY();
  const [isSaving, setIsSaving] = useState(false);
  const [text, setText] = useState(post.text);
  const [postAssets, setPostAssets] = useState(post.postAssets);
  const [postedAt, setPostedAt] = useState(post.postedAt);
  const sessionId = useEditorChat({ kind, text, postAssets, setText });

  const data = postData({ text, postAssets, postedAt });
  const canSave = hasContent(data);

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
          onSave && <PrimaryButton size="compact" label="Save" onPress={handleSave} disabled={!canSave || isSaving} />
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
          <WriteWithAi sessionId={sessionId} text={text} navigation={navigation} />
        </Card>

        <DateTimePicker timestamp={postedAt} onChange={setPostedAt} />
      </Animated.ScrollView>
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
    minHeight: 100,
  },
});
