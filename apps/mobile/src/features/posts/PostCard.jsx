import { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';

import PostCardToolbar from './PostCardToolbar';

import Button from '@/components/Button';
import Card from '@/components/Card';
import TextInput from '@/components/TextInput';
import PostAssetsEditor from '@/features/post-assets-editor/PostAssetsEditor';
import WriteWithAi from '@/features/post-chat/WriteWithAi';
import useSubjectChat from '@/features/post-chat/useSubjectChat';
import { scale } from '@/styles/designTokens';
import buildPostAssets from '@/utils/posts/buildPostAssets';

/**
 * One post of the post editor (`card`: { key, text, postAssets }): its text, its photos once it has
 * any, the toolbar, and Write with AI while it `isActive` (the card being edited), whose chat's Use
 * fills this card. `onChange(key, changes)` and `onActivate(key)` report to the editor; the first
 * card (`isFirst`) has the thread's time (`postedAt`, as text once `isPostedAtShown`,
 * `onChangePostedAt`), a following one × (`onRemove(key)`), the last ⊕ (`onAddToThread`).
 */
export default function PostCard({
  kind,
  card,
  isFirst,
  isActive,
  postedAt,
  isPostedAtShown,
  onChangePostedAt,
  onChange,
  onActivate,
  onRemove,
  onAddToThread,
}) {
  const { key, text, postAssets } = card;
  const setText = useCallback((value) => onChange(key, { text: value }), [onChange, key]);
  const sessionId = useSubjectChat({ kind, text, postAssets, setText });

  // The first card leaves room to write until photos come in under the text.
  const isRoomy = isFirst && postAssets.length === 0;

  function activate() {
    onActivate(key);
  }

  function addPostAssets(assets) {
    onChange(key, { postAssets: [...postAssets, ...buildPostAssets(assets)] });
  }

  return (
    <Card style={styles.card}>
      <View style={styles.top}>
        <TextInput
          multiline
          placeholder="What's new?"
          minHeight={isRoomy ? scale(84) : scale(48)}
          onChangeText={setText}
          onFocus={activate}
          value={text}
          style={styles.text}
        />
        {onRemove && (
          <Button
            icon="close"
            size="small"
            accessibilityLabel="Remove this post"
            onPress={() => onRemove(key)}
            style={styles.remove}
          />
        )}
      </View>
      <PostAssetsEditor postAssets={postAssets} onChange={(value) => onChange(key, { postAssets: value })} />
      <PostCardToolbar
        isFirst={isFirst}
        exclude={postAssets.map((postAsset) => postAsset.asset.id)}
        onAddMedia={addPostAssets}
        postedAt={postedAt}
        isPostedAtShown={isPostedAtShown}
        onChangePostedAt={onChangePostedAt}
        onAddToThread={onAddToThread}
        onActivate={activate}
      />
      {isActive && <WriteWithAi sessionId={sessionId} style={styles.writeWithAi} />}
    </Card>
  );
}

const CARD_SIDE_INSET = scale(15);
const CARD_BOTTOM_INSET = scale(8);

const styles = StyleSheet.create({
  card: {
    paddingTop: scale(14),
    paddingHorizontal: CARD_SIDE_INSET,
    paddingBottom: CARD_BOTTOM_INSET,
    gap: scale(10),
  },
  // The × keeps its place when the text grows: the text takes the rest and wraps.
  top: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  text: {
    flex: 1,
    minWidth: 0,
  },
  // The toolbar's 44 pt row already leaves room under its icons, so the tray follows at the card's
  // gap, and keeps the card's side inset below it.
  writeWithAi: {
    marginBottom: CARD_SIDE_INSET - CARD_BOTTOM_INSET,
  },
  // The × lines up with the text's first line.
  remove: {
    flexShrink: 0,
    marginTop: -scale(2),
  },
});
