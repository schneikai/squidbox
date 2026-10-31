import { useNavigation } from '@react-navigation/native';
import { StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';

import PostListItem from './PostListItem';

import SuperPressable from '@/components/SuperPressable';
import { layout, scale } from '@/styles/designTokens';

const FIRST_ENTRY = { id: 'FirstListEntryComponent' };
const keyExtractor = (post) => post.id;

// The posts list: `rows` are the loaded posts of a paged query (each with its `postAssets`),
// `loadMore` reads the next page when the end comes near. A tap on a post opens it;
// `onDoublePressPost(post)` and `renderPostActions(post)` (shown in the post's card, under it) are
// optional.
export default function PostList({
  rows,
  loadMore,
  ListHeaderComponent,
  FirstListEntryComponent,
  onDoublePressPost,
  renderPostActions,
  listRef,
  contentContainerStyle,
  onScroll,
}) {
  const navigation = useNavigation();
  const data = FirstListEntryComponent ? [FIRST_ENTRY, ...(rows ?? [])] : rows;
  // More is asked for only once the first page landed: until then the list is just the first entry,
  // and a load-more asked then would read a second page at once.
  const onEndReached = rows ? loadMore : undefined;

  if (!data) return null;

  return (
    <Animated.FlatList
      keyboardDismissMode="on-drag"
      data={data}
      renderItem={({ item: post }) =>
        post === FIRST_ENTRY ? (
          FirstListEntryComponent
        ) : (
          <SuperPressable
            onPress={() => navigation.navigate('PostScreen', { postId: post.id })}
            onDoublePress={onDoublePressPost && (() => onDoublePressPost(post))}
            style={styles.post}
          >
            <PostListItem post={post} actions={renderPostActions?.(post)} />
          </SuperPressable>
        )
      }
      keyExtractor={keyExtractor}
      ListHeaderComponent={ListHeaderComponent}
      stickyHeaderIndices={ListHeaderComponent ? [0] : undefined}
      contentContainerStyle={contentContainerStyle}
      onEndReached={onEndReached}
      onEndReachedThreshold={2}
      ref={listRef}
      onScroll={onScroll}
      scrollEventThrottle={16}
    />
  );
}

const styles = StyleSheet.create({
  // Nothing above a post, so the list's top padding alone sets where the first one starts; the room
  // between posts is all below each.
  post: {
    flex: 1,
    paddingHorizontal: layout.sideGutter,
    paddingBottom: scale(14),
  },
});
