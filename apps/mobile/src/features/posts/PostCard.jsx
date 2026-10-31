import { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';

import PostCardToolbar from './PostCardToolbar';

import Button from '@/components/Button';
import Card from '@/components/Card';
import TextInput from '@/components/TextInput';
import PostAssetsEditor from '@/features/post-assets-editor/PostAssetsEditor';
import WriteWithAi from '@/features/post-chat/WriteWithAi';
import useSubjectChat from '@/features/post-chat/useSubjectChat';
import { colors, radii, scale } from '@/styles/designTokens';
import buildPostAssets from '@/utils/posts/buildPostAssets';

const RING = 3;

/**
 * One post of the post editor (`card`: { key, text, postAssets }): its text, its photos once it has
 * any, the toolbar, and Write with AI while it `isActive` (the card being edited), whose chat's Use
 * fills this card. `onChange(key, changes)` and `onActivate(key)` report to the editor; the first card
 * has the thread's time (`postedAt`, `onChangePostedAt`), a following one × (`onRemove(key)`), the
 * last ⊕ (`onAddToThread`). `isRinged` marks the active card while there are several.
 */
export default function PostCard({
  kind,
  card,
  isActive,
  isRinged,
  postedAt,
  onChangePostedAt,
  onChange,
  onActivate,
  onRemove,
  onAddToThread,
  navigation,
}) {
  const { key, text, postAssets } = card;
  const setText = useCallback((value) => onChange(key, { text: value }), [onChange, key]);
  const sessionId = useSubjectChat({ kind, text, postAssets, setText });

  const activate = () => onActivate(key);

  function addPostAssets(assets) {
    onChange(key, { postAssets: [...postAssets, ...buildPostAssets(assets)] });
  }

  return (
    <View style={[styles.ring, isRinged && styles.ringOn]}>
      <Card style={[styles.card, isRinged && styles.cardActive]}>
        <View style={styles.top}>
          <TextInput
            multiline
            placeholder="What's new?"
            minHeight={onChangePostedAt ? scale(84) : scale(48)}
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
          exclude={postAssets.map((postAsset) => postAsset.asset.id)}
          onAddMedia={addPostAssets}
          postedAt={postedAt}
          onChangePostedAt={onChangePostedAt}
          onAddToThread={onAddToThread}
          onActivate={activate}
        />
        {isActive && (
          <WriteWithAi sessionId={sessionId} onOpenChat={(params) => navigation.navigate('PostChatScreen', params)} />
        )}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  // The active card's outer glow: always there, transparent until it shows, so nothing moves.
  ring: {
    margin: -RING,
    padding: RING,
    borderRadius: radii.card + RING,
  },
  ringOn: {
    backgroundColor: colors.accent.light,
  },
  card: {
    paddingTop: scale(14),
    paddingHorizontal: scale(15),
    paddingBottom: scale(8),
    gap: scale(10),
  },
  cardActive: {
    borderColor: colors.accent.border,
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
  remove: {
    flexShrink: 0,
    marginTop: -scale(10),
    marginRight: -scale(12),
  },
});
