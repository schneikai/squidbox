import type { AssetRecord } from '@squidbox/shared';
import { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';

import PostCardToolbar from './PostCardToolbar';
import type { PostEditorKind } from './PostEditor';

import Button from '@/components/Button';
import Card from '@/components/Card';
import TextInput from '@/components/TextInput';
import type { EditorPostAsset } from '@/features/post-assets-editor/PostAsset';
import PostAssetsEditor from '@/features/post-assets-editor/PostAssetsEditor';
// WriteWithAi and useSubjectChat are JS: typed as allowJs infers them (useSubjectChat by its JSDoc).
import WriteWithAi from '@/features/post-chat/WriteWithAi';
import useSubjectChat from '@/features/post-chat/useSubjectChat';
import { layout, scale, space } from '@/styles/designTokens';
import buildPostAssets from '@/utils/posts/buildPostAssets';

export type PostCardData = { key: string; id: string | null; text: string; postAssets: EditorPostAsset[] };

// What a card reports changed to the editor.
export type PostCardChange = Partial<Pick<PostCardData, 'text' | 'postAssets'>>;

type PostCardProps = {
  kind: PostEditorKind;
  card: PostCardData;
  isFirst: boolean;
  isActive: boolean;
  postedAt: number | null;
  isPostedAtShown: boolean;
  onChangePostedAt: (timestamp: number | null) => void;
  onChange: (key: string, changes: PostCardChange) => void;
  onActivate: (key: string) => void;
  onRemove?: (key: string) => void;
  onAddToThread?: () => void;
};

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
}: PostCardProps) {
  const { key, text, postAssets } = card;
  const setText = useCallback((value: string) => onChange(key, { text: value }), [onChange, key]);
  const sessionId = useSubjectChat({ kind, text, postAssets, setText });

  // The first card leaves room to write until photos come in under the text.
  const isRoomy = isFirst && postAssets.length === 0;

  function activate() {
    onActivate(key);
  }

  function addPostAssets(assets: AssetRecord[]) {
    onChange(key, { postAssets: [...postAssets, ...buildPostAssets(assets)] });
  }

  return (
    <Card padded hasControlRow>
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
      <PostAssetsEditor
        postAssets={postAssets}
        onChange={(value) => onChange(key, { postAssets: value })}
        style={styles.assets}
      />
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

const styles = StyleSheet.create({
  // The × keeps its place when the text grows: the text takes the rest and wraps.
  top: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  text: {
    flex: 1,
    minWidth: 0,
  },
  // A card's gap from the text and the toolbar (the card's gap is the toolbar's slack).
  assets: {
    marginVertical: layout.cardGap - layout.controlRowSlack,
  },
  // The toolbar's 44 pt row already leaves room under its icons, so the tray follows at the card's
  // gap, and keeps the card's side inset below it.
  writeWithAi: {
    marginTop: layout.cardGap - layout.controlRowSlack,
    marginBottom: layout.cardInset - layout.controlRowSlack,
  },
  // The × lines up with the text's first line.
  remove: {
    flexShrink: 0,
    marginTop: -space.hair,
  },
});
