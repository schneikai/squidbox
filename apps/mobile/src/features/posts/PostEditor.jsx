import { useState } from 'react';
import { StyleSheet } from 'react-native';

import Card from '@/components/Card';
import DateTimePicker from '@/components/DateTimePicker';
import EditSheet from '@/components/EditSheet';
import Textarea from '@/components/Textarea';
import { SCREEN_PADDING } from '@/constants';
import PostAssetsEditor from '@/features/post-assets-editor/PostAssetsEditor';
import WriteWithAi from '@/features/post-chat/WriteWithAi';
import useEditorChat from '@/features/post-chat/useEditorChat';
import useEditSheet from '@/hooks/useEditSheet';
import changedValues from '@/utils/changedValues';
import isPresent from '@/utils/isPresent';
import postAssetsToAssetRefs from '@/utils/posts/postAssetsToAssetRefs';

// Edits a post seeded from `post` ({ text, postAssets, postedAt }) as a draft sheet: Add (a new
// post, `kind` 'draft') or Done (an edit) hands `onSave` the post the posts store takes ({ text,
// assetRefs, postedAt }), allowed once it is valid (and, for Done, changed), and the seed in the same
// shape, so an edit can save only what changed; a save that throws says so and keeps the editor open.
// Cancel or a swipe down with changes asks first. `kind` is also what its assistant chat is about
// (chatSubjectKindSchema: 'draft' a new post, 'edit' a saved one).
export default function PostEditor({ kind, post, navigation, onSave }) {
  const [text, setText] = useState(post.text);
  const [postAssets, setPostAssets] = useState(post.postAssets);
  const [postedAt, setPostedAt] = useState(post.postedAt);
  const sessionId = useEditorChat({ kind, text, postAssets, setText });

  // The posts store syncs by itself.
  const { sheetProps } = useEditSheet({
    ...draftSheetOptions(kind, post, { text, postAssets, postedAt }, onSave),
    syncsItself: true,
  });

  return (
    <EditSheet {...sheetProps}>
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
    </EditSheet>
  );
}

// What useEditSheet needs to know about the draft `current` of `post`.
function draftSheetOptions(kind, post, current, onSave) {
  const seed = postData(post);
  const data = postData(current);
  return {
    isNew: kind === 'draft',
    isValid: hasContent(data),
    isDirty: isPresent(changedValues(seed, data)),
    save: () => onSave(data, seed),
  };
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
