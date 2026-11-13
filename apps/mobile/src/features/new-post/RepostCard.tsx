import { Pressable, StyleSheet, View } from 'react-native';

import Button from '@/components/Button';
import MenuButton from '@/components/MenuButton';
import Text from '@/components/Text';
import MenuOption from '@/components/popup-menu-options/MenuOption';
import PostPostedAt from '@/features/posts/PostPostedAt';
import PostRowCard from '@/features/posts/PostRowCard';
import { press, space } from '@/styles/designTokens';
import type { PostListRow } from '@/sync/queries/postQuery';
import isPresent from '@/utils/isPresent';

export type RepostCardProps = {
  post: Pick<PostListRow, 'text' | 'postedAt' | 'postAssets'>;
  onOpen: () => void;
  onRepost: () => void;
  onLater: () => void;
  onIgnore: () => void;
};

/**
 * A post offered for a repost on the New post sheet, as a card: its first photo, two lines of its
 * text, when it was posted, then Repost (`onRepost`), Later (`onLater`) and ⋯ with Ignore
 * (`onIgnore`). A tap elsewhere opens the post (`onOpen`).
 */
export default function RepostCard({ post, onOpen, onRepost, onLater, onIgnore }: RepostCardProps) {
  const first = post.postAssets[0]?.asset;

  return (
    <Pressable onPress={onOpen} style={({ pressed }) => pressed && press.flat}>
      <PostRowCard asset={first}>
        {isPresent(post.text) && <Text numberOfLines={2}>{post.text}</Text>}
        <PostPostedAt postedAt={post.postedAt} />
        <View style={styles.actions}>
          <Button variant="primary" size="small" label="Repost" icon="repeat" onPress={onRepost} />
          <Button variant="secondary" size="small" label="Later" onPress={onLater} />
          <MenuButton size="small" accessibilityLabel="More for this post" style={styles.more}>
            <MenuOption label="Ignore" icon="eye-off" onPress={onIgnore} />
          </MenuButton>
        </View>
      </PostRowCard>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // The actions sit at the card's bottom, however many lines the text above them takes.
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginTop: 'auto',
  },
  more: {
    marginLeft: 'auto',
  },
});
