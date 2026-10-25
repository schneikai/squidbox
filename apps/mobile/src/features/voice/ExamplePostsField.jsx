import { PERSONA_LIMITS } from '@squidbox/shared';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity } from 'react-native';

import Card from '@/components/Card';
import Icon from '@/components/Icon';
import IconButton from '@/components/IconButton';
import Textarea from '@/components/Textarea';
import { SCREEN_PADDING } from '@/constants';
import { colors, radii, scale, sizes, typography } from '@/styles/designTokens';

const CARD_WIDTH = scale(220);

/**
 * Example posts: a row of cards, each edited in place, × takes it out. The dashed "Paste a post"
 * card adds an empty one and focuses it; empty posts are dropped on Save, not while typing. The row
 * runs to the screen's edges, so it scrolls under them.
 */
export default function ExamplePostsField({ posts, onChange, placeholder }) {
  // The card "Paste a post" just made, which takes the focus once.
  const [addedIndex, setAddedIndex] = useState(null);

  const canAdd = posts.length < PERSONA_LIMITS.examplePosts;

  function handleAdd() {
    setAddedIndex(posts.length);
    onChange([...posts, '']);
  }

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
            onChangeText={(text) => onChange(posts.map((each, i) => (i === index ? text : each)))}
            placeholder={placeholder}
            maxLength={PERSONA_LIMITS.examplePost}
            autoFocus={index === addedIndex}
            style={styles.input}
          />
          <IconButton
            icon="close"
            size={sizes.iconSmall}
            color={colors.text.secondary}
            onPress={() => onChange(posts.filter((_, i) => i !== index))}
            accessibilityLabel="Remove this post"
            style={styles.remove}
          />
        </Card>
      ))}
      {canAdd && (
        <TouchableOpacity style={styles.add} onPress={handleAdd} activeOpacity={0.6} accessibilityRole="button">
          <Icon name="add" size={sizes.iconSmall} color={colors.accent.base} />
          <Text style={styles.addLabel}>{placeholder}</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

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
    width: CARD_WIDTH,
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
    width: CARD_WIDTH * 0.6,
    minHeight: scale(96),
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: radii.card,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.accent.border,
  },
  addLabel: {
    fontSize: typography.subheadline,
    fontWeight: '500',
    color: colors.accent.base,
  },
});
