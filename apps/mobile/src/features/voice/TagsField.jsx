import { PERSONA_LIMITS } from '@squidbox/shared';
import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import Card from '@/components/Card';
import Chip from '@/components/Chip';
import TextInput from '@/components/TextInput';
import { colors, radii, typography } from '@/styles/designTokens';

/**
 * Your content: the tags as chips, a tap on one takes it out. The dashed Add turns into an input
 * that adds a tag on return (and stays open for the next) and closes on blur, adding what it holds.
 * A tag that is already there (in any case) isn't added twice.
 */
export default function TagsField({ tags, onChange, placeholder }) {
  const [isAdding, setIsAdding] = useState(false);
  const [text, setText] = useState('');

  const canAdd = tags.length < PERSONA_LIMITS.contentTags;

  function addTag() {
    const tag = text.trim();
    setText('');
    if (!tag || tags.some((each) => each.toLowerCase() === tag.toLowerCase())) return;
    onChange([...tags, tag]);
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
      {isAdding ? (
        <TextInput
          value={text}
          onChangeText={setText}
          onSubmitEditing={addTag}
          onBlur={handleBlur}
          submitBehavior="submit"
          // react-native-web knows only the older prop.
          blurOnSubmit={false}
          returnKeyType="done"
          autoFocus
          autoCapitalize="none"
          maxLength={PERSONA_LIMITS.contentTag}
          placeholder="Tag"
          style={styles.input}
        />
      ) : (
        canAdd && <Chip label="Add" variant="add" onPress={() => setIsAdding(true)} accessibilityLabel="Add a tag" />
      )}
      {tags.length === 0 && !isAdding && <Text style={styles.placeholder}>{placeholder}</Text>}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    padding: 12,
  },
  input: {
    minWidth: 96,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.accent.border,
    paddingHorizontal: 11,
    paddingVertical: 6,
    fontSize: typography.subheadline,
  },
  placeholder: {
    fontSize: typography.subheadline,
    color: colors.text.tertiary,
  },
});
