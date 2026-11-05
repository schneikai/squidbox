import PostRowCard from './PostRowCard';

import Text from '@/components/Text';
import isPresent from '@/utils/isPresent';

/**
 * A following post of a thread as a row card (the post screen, an unfolded thread in the posts
 * list): its first picture as a tile ("+N" when it has more), its text beside it. With
 * `onOpenAsset(asset)` a tap on the tile opens the picture; without it (inside something pressable,
 * the posts list) the tile takes no touch. `isTextSelectable` lets a long press copy the text.
 * `entering` and `exiting` are Reanimated layout animations of the card, and `contentStyle` and
 * `contentExiting` an animated style and exiting animation of what's in it (an unfolding thread's);
 * `style` is for layout only.
 */
export default function ThreadPost({
  post,
  onOpenAsset,
  isTextSelectable = false,
  entering,
  exiting,
  style,
  contentStyle,
  contentExiting,
}) {
  const [first, ...more] = post.postAssets.map((postAsset) => postAsset.asset);

  return (
    <PostRowCard
      asset={first}
      moreCount={more.length}
      onPressAsset={onOpenAsset && (() => onOpenAsset(first))}
      entering={entering}
      exiting={exiting}
      style={style}
      contentStyle={contentStyle}
      contentExiting={contentExiting}
    >
      {isPresent(post.text) && <Text selectable={isTextSelectable}>{post.text}</Text>}
    </PostRowCard>
  );
}
