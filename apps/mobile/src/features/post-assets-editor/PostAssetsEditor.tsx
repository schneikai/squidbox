import { View, Text, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import DraggableFlatList, { type DragEndParams } from 'react-native-draggable-flatlist';

import PostAsset, { type EditorPostAsset } from './PostAsset';

import useHaptics from '@/hooks/useHaptics';
import { colors, scale, space } from '@/styles/designTokens';
import listTextStyles from '@/styles/listTextStyles';
import countMediaTypes from '@/utils/assets/countMediaTypes';
import getAssetCountInfo from '@/utils/assets/getAssetCountInfo';

export type PostAssetsEditorProps = {
  postAssets: EditorPostAsset[];
  onChange: (postAssets: EditorPostAsset[]) => void;
  maxCount?: number | null;
  style: StyleProp<ViewStyle>;
};

// The post's assets ([{ id, asset }]) as a strip of tiles under its text, nothing until it has one:
// hold one to reorder, × to take it out. `onChange` gets the new list. With `maxCount` (its channel's
// limit) the caption counts against it ("2 of 4 media"), red over it. style is for layout only.
export default function PostAssetsEditor({ postAssets, onChange, maxCount, style }: PostAssetsEditorProps) {
  const haptics = useHaptics();

  const countInfo =
    maxCount != null
      ? `${postAssets.length} of ${maxCount} media`
      : getAssetCountInfo(countMediaTypes(postAssets.map((postAsset) => postAsset.asset)));
  const caption = postAssets.length > 1 ? `${countInfo} · hold to reorder` : countInfo;
  const isOver = maxCount != null && postAssets.length > maxCount;

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
            onDelete={deletePostAsset}
            onLongPress={drag}
            isActive={isActive}
            style={styles.tile}
          />
        )}
      />
      <Text style={[listTextStyles.caption, isOver && styles.over]}>{caption}</Text>
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
  over: {
    color: colors.status.danger,
  },
  tile: {
    width: scale(120),
    height: scale(160),
  },
});
