import { Pressable, StyleSheet, View } from 'react-native';

import Button from '@/components/Button';
import Card from '@/components/Card';
import CoverImage from '@/components/CoverImage';
import MenuButton from '@/components/MenuButton';
import Text from '@/components/Text';
import MenuOption from '@/components/popup-menu-options/MenuOption';
import PostPostedAt from '@/features/posts/PostPostedAt';
import { press, scale } from '@/styles/designTokens';
import isPresent from '@/utils/isPresent';

/**
 * A post offered for a repost on the New post sheet, as a card: its first photo, two lines of its
 * text, when it was posted, then Repost (`onRepost`), Later (`onLater`) and ⋯ with Ignore
 * (`onIgnore`). A tap elsewhere opens the post (`onOpen`).
 */
export default function RepostCard({ post, onOpen, onRepost, onLater, onIgnore }) {
  const first = post.postAssets[0]?.asset;

  return (
    <Pressable onPress={onOpen} style={({ pressed }) => pressed && press.flat}>
      <Card style={styles.row}>
        <CoverImage asset={first} style={styles.photo} />
        <View style={styles.body}>
          {isPresent(post.text) && <Text numberOfLines={2}>{post.text}</Text>}
          <PostPostedAt postedAt={post.postedAt} />
          <View style={styles.actions}>
            <Button variant="primary" size="small" label="Repost" icon="repeat" onPress={onRepost} />
            <Button variant="secondary" size="small" label="Later" colorPalette="neutral" onPress={onLater} />
            <MenuButton accessibilityLabel="More for this post" style={styles.more}>
              <MenuOption label="Ignore" icon="eye-off" onPress={onIgnore} />
            </MenuButton>
          </View>
        </View>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: scale(12),
    padding: scale(12),
  },
  photo: {
    width: scale(72),
    height: scale(96),
  },
  body: {
    flex: 1,
    minWidth: 0,
    gap: scale(6),
  },
  // The actions sit at the card's bottom, however many lines the text above them takes.
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(6),
    marginTop: 'auto',
  },
  // The ⋯'s 44 pt target reaches into the card's padding, so its dots line up with the card's edge.
  more: {
    marginLeft: 'auto',
    marginRight: -scale(12),
  },
});
