import { PERSONA_LIMITS } from '@squidbox/shared';
import { memo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import useEditableList from './useEditableList';

import Card from '@/components/Card';
import Chip from '@/components/Chip';
import IconButton from '@/components/IconButton';
import Textarea from '@/components/Textarea';
import { SCREEN_PADDING } from '@/constants';
import { colors, scale, sizes, typography } from '@/styles/designTokens';

/**
 * Example posts: a row of cards, each edited in place, × takes it out. The dashed "Paste a post"
 * adds an empty one and focuses it; empty posts are dropped on Save, not while typing. The row runs
 * to the screen's edges, so it scrolls under them.
 */
function ExamplePostsField({ posts, onChange, placeholder }) {
  const list = useEditableList(posts, onChange);

  const canAdd = posts.length < PERSONA_LIMITS.examplePosts;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      style={styles.scroller}
      contentContainerStyle={styles.row}
    >
      {posts.map((post, index) => (
        // Keyed by index: a post's text changes with every keystroke, and two can be the same.
        <Card key={index} style={styles.card}>
          <Textarea
            value={post}
            onChangeText={(text) => list.change(index, text)}
            placeholder={placeholder}
            maxLength={PERSONA_LIMITS.examplePost}
            autoFocus={list.isAdded(index)}
            style={styles.input}
          />
          <IconButton
            icon="close"
            size={sizes.iconSmall}
            color={colors.text.secondary}
            onPress={() => list.remove(index)}
            accessibilityLabel="Remove this post"
            style={styles.remove}
          />
        </Card>
      ))}
      {canAdd && (
        <View style={styles.add}>
          <Chip label={placeholder} variant="add" onPress={list.add} />
        </View>
      )}
    </ScrollView>
  );
}

export default memo(ExamplePostsField);

const styles = StyleSheet.create({
  scroller: {
    marginHorizontal: -SCREEN_PADDING,
  },
  row: {
    paddingHorizontal: SCREEN_PADDING,
    gap: 12,
    alignItems: 'stretch',
  },
  card: {
    width: scale(220),
    minHeight: scale(96),
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  input: {
    flex: 1,
    paddingLeft: 14,
    paddingVertical: 10,
    fontSize: typography.subheadline,
  },
  remove: {
    marginTop: 2,
  },
  add: {
    minHeight: scale(96),
    justifyContent: 'center',
  },
});
