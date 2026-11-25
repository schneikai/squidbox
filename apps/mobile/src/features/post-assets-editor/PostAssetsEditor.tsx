import type { Channel } from '@squidbox/shared';
import { router } from 'expo-router';
import { View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import DraggableFlatList, { type DragEndParams } from 'react-native-draggable-flatlist';

import PostAsset, { type EditorPostAsset } from './PostAsset';

import Text from '@/components/Text';
import assetHref from '@/features/asset-list/assetHref';
import isMediaOver from '@/features/channels/isMediaOver';
import useHaptics from '@/hooks/useHaptics';
import { scale, space } from '@/styles/designTokens';
import assetCountText from '@/utils/assets/assetCountText';
import countMediaTypes from '@/utils/assets/countMediaTypes';
import getAssetCountInfo from '@/utils/assets/getAssetCountInfo';

export type PostAssetsEditorProps = {
  // The post being edited, once saved: its trashed assets open too, as on the post's screen.
  postId: string | null;
  postAssets: EditorPostAsset[];
  onChange: (postAssets: EditorPostAsset[]) => void;
  channel?: Pick<Channel, 'maxMedia'>;
  style: StyleProp<ViewStyle>;
};

// The post's assets ([{ id, asset }]) as a strip of tiles under its text, nothing until it has one:
// tap one to see it (the asset screen, swiping through the strip in its order), hold one to reorder,
// × to take it out. `onChange` gets the new list. With `channel` (a copy's) the
// caption counts against its media limit ("2 of 4 Assets"), red over it. style is for layout only.
export default function PostAssetsEditor({ postId, postAssets, onChange, channel, style }: PostAssetsEditorProps) {
  const haptics = useHaptics();

  const countInfo =
    channel?.maxMedia != null
      ? `${postAssets.length} of ${assetCountText(channel.maxMedia)}`
      : getAssetCountInfo(countMediaTypes(postAssets.map((postAsset) => postAsset.asset)));
  const caption = postAssets.length > 1 ? `${countInfo} · hold to reorder` : countInfo;

  function openPostAsset(postAsset: EditorPostAsset) {
    const ids = postAssets.map((x) => x.asset.id);
    router.push(assetHref(postAsset.asset.id, { scope: postId ? { postId } : 'library' }, ids));
  }

  function deletePostAsset(postAsset: EditorPostAsset) {
    onChange(postAssets.filter((x) => x.id !== postAsset.id));
  }

  function handleDragEnd({ data, from, to }: DragEndParams<EditorPostAsset>) {
    if (from !== to) haptics.drop();
    onChange(data);
  }

  if (postAssets.length === 0) return null;

  return (
    <View style={[styles.container, style]}>
      <DraggableFlatList
        data={postAssets}
        horizontal
        showsHorizontalScrollIndicator={false}
        onDragBegin={haptics.lift}
        onDragEnd={handleDragEnd}
        keyExtractor={(postAsset) => postAsset.id}
        contentContainerStyle={styles.strip}
        renderItem={({ item: postAsset, drag, isActive }) => (
          <PostAsset
            postAsset={postAsset}
            onPress={openPostAsset}
            onDelete={deletePostAsset}
            onLongPress={drag}
            isActive={isActive}
            style={styles.tile}
          />
        )}
      />
      <Text variant="label" tone={isMediaOver(channel, postAssets.length) ? 'danger' : undefined}>
        {caption}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: space.sm,
  },
  strip: {
    gap: space.sm,
  },
  tile: {
    width: scale(120),
    height: scale(160),
  },
});
