import { View, Text, StyleSheet } from 'react-native';
import DraggableFlatList from 'react-native-draggable-flatlist';

import PostAsset from './PostAsset';

import useHaptics from '@/hooks/useHaptics';
import { scale } from '@/styles/designTokens';
import listTextStyles from '@/styles/listTextStyles';
import countMediaTypes from '@/utils/assets/countMediaTypes';
import getAssetCountInfo from '@/utils/assets/getAssetCountInfo';

const TILE = { width: scale(120), height: scale(160) };
const TILE_GAP = scale(8);

// The post's assets ([{ id, asset }]) as a strip of tiles under its text, nothing until it has one:
// hold one to reorder, × to take it out. `onChange` gets the new list.
export default function PostAssetsEditor({ postAssets, onChange }) {
  const haptics = useHaptics();

  const countInfo = getAssetCountInfo(countMediaTypes(postAssets.map((postAsset) => postAsset.asset)));
  const caption = postAssets.length > 1 ? `${countInfo} · hold to reorder` : countInfo;

  function deletePostAsset(postAsset) {
    onChange(postAssets.filter((x) => x.id !== postAsset.id));
  }

  function handleDragEnd({ data, from, to }) {
    if (from !== to) haptics.drop();
    onChange(data);
  }

  if (postAssets.length === 0) return null;

  return (
    <View style={styles.container}>
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
            itemDimension={TILE}
          />
        )}
      />
      <Text style={listTextStyles.caption}>{caption}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: scale(8),
  },
  strip: {
    gap: TILE_GAP,
  },
});
