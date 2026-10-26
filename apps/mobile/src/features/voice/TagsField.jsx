import { PERSONA_LIMITS, uniqueTags } from '@squidbox/shared';
import { memo, useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import TagInput from './TagInput';

import Card from '@/components/Card';
import Chip from '@/components/Chip';
import { colors, typography } from '@/styles/designTokens';

/**
 * Your content: the tags as chips, a tap on one takes it out. The dashed Add turns into an input
 * that adds a tag on return (and stays open for the next) and closes on blur, adding what it holds.
 * A tag that is already there (in any case) isn't added twice.
 */
function TagsField({ tags, onChange, placeholder }) {
  const [isAdding, setIsAdding] = useState(false);
  const [text, setText] = useState('');

  const canAdd = tags.length < PERSONA_LIMITS.contentTags;

  function addTag() {
    const next = uniqueTags([...tags, text]);
    setText('');
    if (next.length === tags.length) return;
    onChange(next);
    // The last tag there's room for closes the input.
    if (next.length >= PERSONA_LIMITS.contentTags) setIsAdding(false);
  }

  function handleBlur() {
    addTag();
    setIsAdding(false);
  }

  return (
    <Card style={styles.card}>
      {tags.map((tag) => (
        <Chip
          key={tag}
          label={tag}
          variant="accent"
          onPress={() => onChange(tags.filter((each) => each !== tag))}
          accessibilityHint="Removes this tag"
        />
      ))}
      {isAdding && canAdd ? (
        <TagInput value={text} onChangeText={setText} onSubmit={addTag} onBlur={handleBlur} />
      ) : (
        canAdd && <Chip label="Add" variant="add" onPress={() => setIsAdding(true)} accessibilityLabel="Add a tag" />
      )}
      {tags.length === 0 && !isAdding && <Text style={styles.placeholder}>{placeholder}</Text>}
    </Card>
  );
}

export default memo(TagsField);

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    padding: 12,
  },
  placeholder: {
    fontSize: typography.subheadline,
    color: colors.text.tertiary,
  },
});
